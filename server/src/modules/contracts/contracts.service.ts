import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ContractStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { AuditService } from '../audit/audit.service'
import { pageResult } from '../../common/dto/pagination.dto'
import { toNumber } from '../../common/utils/money'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type { ContractQueryDto, TerminateContractDto } from './dto/contract.dto'

const CONTRACT_INCLUDE = {
  organization: true,
  building: true,
  unit: true,
  documents: { orderBy: { createdAt: 'desc' } },
  timeline: { orderBy: { position: 'asc' } },
  schedule: { orderBy: { position: 'asc' } },
} satisfies Prisma.ContractInclude

type ContractFull = Prisma.ContractGetPayload<{ include: typeof CONTRACT_INCLUDE }>

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: ContractQueryDto) {
    const where: Prisma.ContractWhereInput = {
      buildingId: this.scope.buildingFilterFor(user, query.buildingId),
      organizationId: this.scope.organizationFilter(user),
      status: query.status,
      type: query.type,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { tenantName: { contains: query.search, mode: 'insensitive' } },
              { unitCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: CONTRACT_INCLUDE,
        orderBy: { startsAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.contract.count({ where }),
    ])

    return pageResult(items.map((item) => this.present(item)), total, query)
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const contract = await this.load(id)
    this.scope.assertBuilding(user, contract.buildingId)
    this.scope.assertOrganization(user, contract.organizationId)
    return this.present(contract)
  }

  async documents(user: AuthenticatedUser, id: string) {
    const contract = await this.load(id)
    this.scope.assertBuilding(user, contract.buildingId)
    this.scope.assertOrganization(user, contract.organizationId)
    return contract.documents.map((doc) => ({
      id: doc.id,
      kind: doc.kind,
      name: doc.fileName,
      size: `${Math.max(1, Math.round(doc.size / 1024))} KB`,
      type: doc.extension,
      hash: doc.hash,
      uploadedAt: doc.createdAt.toISOString(),
      uploadedBy: doc.uploadedByName,
    }))
  }

  /** Shartnomani bekor qilish, sabab audit yozuviga tushadi. */
  async terminate(user: AuthenticatedUser, id: string, dto: TerminateContractDto) {
    const contract = await this.load(id)
    this.scope.assertBuilding(user, contract.buildingId)

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new ConflictException({
        message: 'Faqat faol shartnomani bekor qilish mumkin',
        reason: 'INVALID_STATE',
        current: contract.status,
      })
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.contract.update({
        where: { id },
        data: {
          status: ContractStatus.TERMINATED,
          terminatedAt: new Date(),
          terminationReason: dto.reason,
        },
        include: CONTRACT_INCLUDE,
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Shartnoma bekor qilindi',
          entityType: 'contract',
          entityId: id,
          detail: dto.reason,
          meta: { from: contract.status, to: ContractStatus.TERMINATED },
        },
        tx,
      )

      return result
    })

    return this.present(updated)
  }

  private async load(id: string): Promise<ContractFull> {
    const contract = await this.prisma.contract.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: CONTRACT_INCLUDE,
    })
    if (!contract) throw new NotFoundException('Shartnoma topilmadi')
    return contract
  }

  private present(contract: ContractFull) {
    return {
      id: contract.id,
      code: contract.code,
      type: contract.type,
      tenant: contract.tenantName,
      organizationId: contract.organizationId,
      buildingId: contract.buildingId,
      buildingName: contract.buildingName,
      unitId: contract.unitId,
      unitCode: contract.unitCode,
      startsAt: contract.startsAt.toISOString().slice(0, 10),
      endsAt: contract.endsAt?.toISOString().slice(0, 10) ?? null,
      status: contract.status,
      amount: toNumber(contract.amount),
      paymentTerm: contract.paymentTerm,
      body: contract.body,
      documents: contract.documents.map((doc) => ({
        name: doc.fileName,
        size: `${Math.max(1, Math.round(doc.size / 1024))} KB`,
        type: doc.extension,
      })),
      timeline: contract.timeline.map((entry) => ({
        label: entry.label,
        date: entry.occurredAt?.toISOString().slice(0, 10) ?? '-',
        actor: entry.actor,
        done: entry.done,
      })),
      schedule: contract.schedule.map((row) => ({
        id: row.id,
        kind: row.kind,
        label: row.label,
        dueAt: row.dueAt.toISOString().slice(0, 10),
        total: toNumber(row.total),
        status: row.status,
      })),
    }
  }
}
