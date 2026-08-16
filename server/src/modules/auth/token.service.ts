import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { randomUUID, createHash } from 'node:crypto'
import type { User } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  RegistrationTokenPayload,
} from '../../common/rbac/authenticated-user'

/** «15m», «30d», «3600» ko‘rinishidagi muddatni sekundga aylantiradi. */
export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])?$/.exec(ttl.trim())
  if (!match) return 900
  const value = Number(match[1])
  switch (match[2]) {
    case 'd':
      return value * 86_400
    case 'h':
      return value * 3_600
    case 'm':
      return value * 60
    default:
      return value
  }
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private secret(kind: 'access' | 'refresh'): string {
    return this.config.get<string>(kind === 'access' ? 'jwt.accessSecret' : 'jwt.refreshSecret') ?? ''
  }

  accessTtlSeconds(): number {
    return ttlToSeconds(this.config.get<string>('jwt.accessTtl') ?? '15m')
  }

  refreshTtlSeconds(): number {
    return ttlToSeconds(this.config.get<string>('jwt.refreshTtl') ?? '30d')
  }

  /** Kirish va yangilash juftligini beradi, yangilash tokeni bazada qayd etiladi. */
  async issuePair(user: User, userAgent?: string) {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      org: user.organizationId,
      typ: 'access',
    }

    const jti = randomUUID()
    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti, typ: 'refresh' }

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.secret('access'),
      expiresIn: this.accessTtlSeconds(),
    })

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.secret('refresh'),
      expiresIn: this.refreshTtlSeconds(),
    })

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.digest(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds() * 1000),
        userAgent,
      },
    })

    return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds() }
  }

  /** Yangilash tokenini tekshiradi va eskisini bekor qiladi. */
  async rotate(refreshToken: string, userAgent?: string) {
    let payload: RefreshTokenPayload
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.secret('refresh'),
      })
    } catch {
      throw new UnauthorizedException('Yangilash tokeni yaroqsiz')
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.digest(refreshToken) },
    })
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Sessiya muddati tugagan, qaytadan kiring')
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.isActive) throw new UnauthorizedException('Hisob faol emas')

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })

    return this.issuePair(user, userAgent)
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.digest(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  /** Ro‘yxatdan o‘tishning uchinchi qadamiga o‘tish uchun qisqa muddatli token. */
  signRegistrationToken(phone: string): Promise<string> {
    const payload: RegistrationTokenPayload = { phone, typ: 'registration' }
    return this.jwt.signAsync(payload, {
      secret: this.secret('access'),
      expiresIn: ttlToSeconds(this.config.get<string>('jwt.registrationTtl') ?? '15m'),
    })
  }

  async readRegistrationToken(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<RegistrationTokenPayload>(token, {
        secret: this.secret('access'),
      })
      if (payload.typ !== 'registration') throw new Error('noto‘g‘ri tur')
      return payload.phone
    } catch {
      throw new UnauthorizedException('Ro‘yxatdan o‘tish tokeni yaroqsiz yoki muddati tugagan')
    }
  }

  /** Tokenning o‘zi emas, yig‘indisi saqlanadi. */
  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
