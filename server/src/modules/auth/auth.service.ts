import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { TooManyRequestsException } from '../../common/exceptions/too-many-requests.exception'
import { ConfigService } from '@nestjs/config'
import { createHash, randomInt } from 'node:crypto'
import { OrganizationKind, OtpPurpose, Role } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { PasswordService } from './password.service'
import { TokenService } from './token.service'
import { OTP_SENDER, type OtpSender } from './otp/otp-sender.interface'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { ROLE_CAPABILITIES, ROLE_HOME, ROLE_LABELS } from '../../common/rbac/capabilities'
import type {
  LoginDto,
  RegisterCompleteDto,
  RegisterPhoneDto,
  RegisterVerifyDto,
} from './dto/auth.dto'

/** Raqamni yagona ko‘rinishga keltiradi: +998901234567. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('998') ? `+${digits}` : `+998${digits}`
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
  ) {}

  // -------------------------------------------------------------------------
  // Xodimlar kirishi

  /**
   * Login va parol bo‘yicha kirish. Rol hisobga biriktirilgan, so‘rovda
   * rol tanlash imkoniyati yo‘q.
   */
  async login(dto: LoginDto, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { login: dto.login.trim().toLowerCase() },
      include: { organization: true },
    })

    const valid = user ? await this.passwords.verify(user.passwordHash, dto.password) : false
    if (!user || !valid) {
      throw new UnauthorizedException('Login yoki parol noto‘g‘ri')
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Hisob faol emas, tizim ma’muriga murojaat qiling')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const pair = await this.tokens.issuePair(user, userAgent)

    await this.audit.record({
      actor: this.toSession(user, user.organization.name, user.organization.tin, user.organization.address),
      action: 'Tizimga kirdi',
      entityType: 'user',
      entityId: user.id,
      detail: `${ROLE_LABELS[user.role]} sifatida kirdi`,
    })

    return {
      ...pair,
      user: this.profile(
        this.toSession(user, user.organization.name, user.organization.tin, user.organization.address),
      ),
    }
  }

  // -------------------------------------------------------------------------
  // Ijarachi o‘zi ro‘yxatdan o‘tadi

  /** Birinchi qadam: raqamga bir martalik kod yuboriladi. */
  async requestOtp(dto: RegisterPhoneDto) {
    const phone = normalizePhone(dto.phone)

    const existing = await this.prisma.user.findUnique({ where: { phone } })
    if (existing) {
      throw new ConflictException('Bu raqam bo‘yicha hisob allaqachon mavjud, tizimga kiring')
    }

    const resendSeconds = this.config.get<number>('otp.resendSeconds') ?? 60
    const recent = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        purpose: OtpPurpose.REGISTRATION,
        consumedAt: null,
        createdAt: { gt: new Date(Date.now() - resendSeconds * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (recent) {
      const waitFor = Math.ceil(
        (recent.createdAt.getTime() + resendSeconds * 1000 - Date.now()) / 1000,
      )
      throw new TooManyRequestsException(
        `Kodni qayta yuborish uchun ${Math.max(1, waitFor)} sekund kuting`,
      )
    }

    const length = this.config.get<number>('otp.length') ?? 6
    const ttlSeconds = this.config.get<number>('otp.ttlSeconds') ?? 300
    const code = this.generateCode(length)

    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash: this.digestCode(phone, code),
        purpose: OtpPurpose.REGISTRATION,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    })

    await this.otpSender.send({ phone, code, ttlSeconds })

    return {
      phone,
      channel: this.otpSender.channel,
      ttlSeconds,
      resendAfterSeconds: resendSeconds,
      message: 'Tasdiqlash kodi yuborildi',
    }
  }

  /** Ikkinchi qadam: kod tekshiriladi va qisqa muddatli token beriladi. */
  async verifyOtp(dto: RegisterVerifyDto) {
    const phone = normalizePhone(dto.phone)
    const maxAttempts = this.config.get<number>('otp.maxAttempts') ?? 5

    const record = await this.prisma.otpCode.findFirst({
      where: { phone, purpose: OtpPurpose.REGISTRATION, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    if (!record) throw new BadRequestException('Kod topilmadi, qaytadan so‘rang')
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Kod muddati tugagan, qaytadan so‘rang')
    }
    if (record.attempts >= maxAttempts) {
      throw new TooManyRequestsException('Urinishlar soni tugadi, yangi kod so‘rang')
    }

    if (record.codeHash !== this.digestCode(phone, dto.code.trim())) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      })
      throw new BadRequestException('Kod noto‘g‘ri')
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    })

    return {
      registrationToken: await this.tokens.signRegistrationToken(phone),
      phone,
    }
  }

  /** Uchinchi qadam: tashkilot va hisob yaratiladi, rol TENANT_OWNER. */
  async completeRegistration(dto: RegisterCompleteDto, userAgent?: string) {
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException('Parol va tasdiqlash mos kelmadi')
    }

    const phone = await this.tokens.readRegistrationToken(dto.registrationToken)

    if (dto.kind === OrganizationKind.LEGAL_ENTITY && !dto.tin) {
      throw new BadRequestException('Yuridik shaxs uchun STIR majburiy')
    }

    const existing = await this.prisma.user.findUnique({ where: { phone } })
    if (existing) throw new ConflictException('Bu raqam bo‘yicha hisob allaqachon mavjud')

    if (dto.tin) {
      const sameTin = await this.prisma.organization.findUnique({ where: { tin: dto.tin } })
      if (sameTin) throw new ConflictException('Bu STIR bo‘yicha tashkilot allaqachon ro‘yxatdan o‘tgan')
    }

    const passwordHash = await this.passwords.hash(dto.password)

    const created = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name.trim(),
          kind: dto.kind,
          tin: dto.tin ?? null,
          director: dto.director ?? dto.name.trim(),
          phone,
          email: dto.email ?? null,
          address: dto.address ?? null,
        },
      })

      const user = await tx.user.create({
        data: {
          login: phone,
          passwordHash,
          fullName: dto.director ?? dto.name.trim(),
          role: Role.TENANT_OWNER,
          position: dto.kind === OrganizationKind.LEGAL_ENTITY ? 'Direktor' : null,
          phone,
          email: dto.email ?? null,
          organizationId: organization.id,
        },
        include: { organization: true },
      })

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorName: user.fullName,
          actorRole: ROLE_LABELS[Role.TENANT_OWNER],
          action: 'Ro‘yxatdan o‘tdi',
          entityType: 'user',
          entityId: user.id,
          detail: `${organization.name} tashkiloti va shaxsiy kabinet yaratildi`,
        },
      })

      return user
    })

    const pair = await this.tokens.issuePair(created, userAgent)
    const session = this.toSession(
      created,
      created.organization.name,
      created.organization.tin,
      created.organization.address,
    )

    return { ...pair, user: this.profile(session) }
  }

  // -------------------------------------------------------------------------

  async refresh(refreshToken: string, userAgent?: string) {
    return this.tokens.rotate(refreshToken, userAgent)
  }

  async logout(user: AuthenticatedUser, refreshToken?: string) {
    if (refreshToken) await this.tokens.revoke(refreshToken)
    else await this.tokens.revokeAllForUser(user.id)
    return { message: 'Sessiya yopildi' }
  }

  /** Joriy sessiya va uning huquqlari. */
  profile(user: AuthenticatedUser) {
    return {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      organization: user.organizationName,
      organizationId: user.organizationId,
      buildingScope: user.buildingScope,
      warehouseScope: user.warehouseScope,
      position: user.position,
      phone: user.phone,
      email: user.email,
      tin: user.tin,
      address: user.address,
      capabilities: ROLE_CAPABILITIES[user.role],
      home: ROLE_HOME[user.role],
    }
  }

  // -------------------------------------------------------------------------

  private toSession(
    user: {
      id: string
      login: string
      fullName: string
      role: Role
      organizationId: string
      buildingScope: string[]
      warehouseScope: string[]
      position: string | null
      phone: string
      email: string | null
    },
    organizationName: string,
    tin: string | null,
    address: string | null,
  ): AuthenticatedUser {
    return {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role,
      organizationId: user.organizationId,
      organizationName,
      buildingScope: user.buildingScope,
      warehouseScope: user.warehouseScope,
      position: user.position,
      phone: user.phone,
      email: user.email,
      tin,
      address,
    }
  }

  private generateCode(length: number): string {
    const max = 10 ** length
    return String(randomInt(0, max)).padStart(length, '0')
  }

  /** Kod ochiq holda saqlanmaydi: raqam bilan birga yig‘indi olinadi. */
  private digestCode(phone: string, code: string): string {
    return createHash('sha256').update(`${phone}:${code}`).digest('hex')
  }
}
