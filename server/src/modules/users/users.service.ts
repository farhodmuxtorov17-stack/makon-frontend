import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, Role } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { PasswordService } from '../auth/password.service'
import { TokenService } from '../auth/token.service'
import { AuditService } from '../audit/audit.service'
import { pageResult } from '../../common/dto/pagination.dto'
import { ROLE_CAPABILITIES, ROLE_LABELS } from '../../common/rbac/capabilities'
import { normalizePhone } from '../auth/auth.service'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
  UserQueryDto,
} from './dto/user.dto'

/** Xodim hisoblarini super rahbar yaratadi va boshqaradi. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async list(query: UserQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      isActive: query.active === undefined ? undefined : query.active === 'true',
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { login: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { organization: true },
        orderBy: { fullName: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ])

    return pageResult(items.map((item) => this.present(item)), total, query)
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    })
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi')
    return this.present(user)
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto) {
    const login = dto.login.trim().toLowerCase()
    const phone = normalizePhone(dto.phone)

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ login }, { phone }] },
    })
    if (existing) throw new ConflictException('Bu login yoki telefon raqami band')

    const created = await this.prisma.user.create({
      data: {
        login,
        passwordHash: await this.passwords.hash(dto.password),
        fullName: dto.fullName,
        role: dto.role,
        position: dto.position,
        phone,
        email: dto.email,
        organizationId: actor.organizationId,
        buildingScope: dto.buildingScope ?? [],
        warehouseScope: dto.warehouseScope ?? [],
      },
      include: { organization: true },
    })

    await this.audit.record({
      actor,
      action: 'Foydalanuvchi yaratildi',
      entityType: 'user',
      entityId: created.id,
      detail: `${created.fullName}, ${ROLE_LABELS[created.role]}`,
    })

    return this.present(created)
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi')

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      include: { organization: true },
    })

    if (dto.isActive === false || (dto.role && dto.role !== user.role)) {
      await this.tokens.revokeAllForUser(id)
    }

    await this.audit.record({
      actor,
      action: 'Foydalanuvchi yangilandi',
      entityType: 'user',
      entityId: id,
      detail: Object.keys(dto).join(', '),
      meta: { from: user.role, to: updated.role },
    })

    return this.present(updated)
  }

  /** Parolni tiklash, barcha ochiq sessiyalar yopiladi. */
  async resetPassword(actor: AuthenticatedUser, id: string, dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi')

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await this.passwords.hash(dto.password) },
    })
    await this.tokens.revokeAllForUser(id)

    await this.audit.record({
      actor,
      action: 'Parol tiklandi',
      entityType: 'user',
      entityId: id,
      detail: user.fullName,
    })

    return { id, message: 'Parol yangilandi, ochiq sessiyalar yopildi' }
  }

  async deactivate(actor: AuthenticatedUser, id: string) {
    return this.update(actor, id, { isActive: false })
  }

  /** Rollar va ularning huquqlari, sozlamalar sahifasi uchun. */
  roles() {
    return Object.values(Role).map((role) => ({
      code: role,
      label: ROLE_LABELS[role],
      capabilities: ROLE_CAPABILITIES[role],
    }))
  }

  private present(user: Prisma.UserGetPayload<{ include: { organization: true } }>) {
    return {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      organization: user.organization.name,
      organizationId: user.organizationId,
      position: user.position,
      phone: user.phone,
      email: user.email,
      isActive: user.isActive,
      buildingScope: user.buildingScope,
      warehouseScope: user.warehouseScope,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    }
  }
}
