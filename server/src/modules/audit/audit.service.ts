import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { ROLE_LABELS } from '../../common/rbac/capabilities'
import { pageResult, type PaginationQueryDto } from '../../common/dto/pagination.dto'

export interface AuditInput {
  actor: AuthenticatedUser | { id: string | null; fullName: string; roleLabel: string }
  action: string
  entityType: string
  entityId: string
  detail?: string
  meta?: Prisma.InputJsonValue
  ip?: string
}

/** Tranzaksiya ichida ham, undan tashqarida ham ishlaydigan mijoz. */
type Client = PrismaService | Prisma.TransactionClient

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Har bir holat o‘tishi va muhim amal shu yerdan yozuvga tushadi. */
  async record(input: AuditInput, client?: Client) {
    const db = client ?? this.prisma
    const actorName = 'fullName' in input.actor ? input.actor.fullName : 'Tizim'
    const actorRole =
      'role' in input.actor ? ROLE_LABELS[input.actor.role] : input.actor.roleLabel

    return db.auditLog.create({
      data: {
        actorId: input.actor.id,
        actorName,
        actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        detail: input.detail ?? '',
        meta: input.meta,
        ip: input.ip,
      },
    })
  }

  /** Tizim tomonidan avtomatik bajarilgan amal. */
  async recordSystem(
    input: Omit<AuditInput, 'actor'> & { actorName?: string },
    client?: Client,
  ) {
    return this.record(
      {
        ...input,
        actor: { id: null, fullName: input.actorName ?? 'Tizim', roleLabel: 'Avtomatik' },
      },
      client,
    )
  }

  async list(query: PaginationQueryDto, filters: { entityType?: string; entityId?: string; actorId?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      entityType: filters.entityType,
      entityId: filters.entityId,
      actorId: filters.actorId,
      ...(query.search
        ? {
            OR: [
              { action: { contains: query.search, mode: 'insensitive' } },
              { detail: { contains: query.search, mode: 'insensitive' } },
              { actorName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return pageResult(items, total, query)
  }

  /** Bitta yozuv bo‘yicha tarix, ijara ishining audit chizig‘i uchun. */
  async trail(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
    })
  }
}
