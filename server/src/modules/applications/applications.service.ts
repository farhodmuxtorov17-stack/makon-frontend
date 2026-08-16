import { Injectable, NotFoundException } from '@nestjs/common'
import { LeaseStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { pageResult } from '../../common/dto/pagination.dto'
import { toNumber } from '../../common/utils/money'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type { ApplicationQueryDto } from './dto/application.dto'

const APPLICATION_INCLUDE = {
  organization: true,
  unit: true,
  building: true,
  commercialOffer: true,
} satisfies Prisma.LeaseCaseInclude

type ApplicationRow = Prisma.LeaseCaseGetPayload<{ include: typeof APPLICATION_INCLUDE }>

/** Ariza qaysi bosqichda turgani, ro‘yxatdagi «Bosqich» ustuni. */
function stageOf(status: LeaseStatus): string {
  switch (status) {
    case LeaseStatus.YANGI:
      return 'Bino rahbari'
    case LeaseStatus.OPERATSIYA_TASDIQLADI:
      return 'Buxgalter'
    default:
      return 'Yakuniy'
  }
}

/**
 * Ariza reyestri: ijara ishining ro‘yxatdagi qisqa ko‘rinishi.
 * Yozuv manbasi bitta, shuning uchun ijarachi, bino rahbari va buxgalter
 * bir xil holatni ko‘radi.
 */
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  async list(user: AuthenticatedUser, query: ApplicationQueryDto) {
    const where: Prisma.LeaseCaseWhereInput = {
      buildingId: this.scope.buildingFilterFor(user, query.buildingId),
      organizationId: this.scope.organizationFilter(user),
      applicationStatus: query.status,
      status: query.leaseStatus,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { organization: { name: { contains: query.search, mode: 'insensitive' } } },
              { unit: { code: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.leaseCase.findMany({
        where,
        include: APPLICATION_INCLUDE,
        orderBy: { submittedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.leaseCase.count({ where }),
    ])

    return pageResult(items.map((item) => this.present(item)), total, query)
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const item = await this.prisma.leaseCase.findUnique({
      where: { id },
      include: APPLICATION_INCLUDE,
    })
    if (!item) throw new NotFoundException('Ariza topilmadi')
    this.scope.assertBuilding(user, item.buildingId)
    this.scope.assertOrganization(user, item.organizationId)
    return this.present(item)
  }

  /** Ro‘yxat sarlavhasidagi hisoblagichlar. */
  async summary(user: AuthenticatedUser) {
    const where: Prisma.LeaseCaseWhereInput = {
      buildingId: this.scope.buildingFilter(user),
      organizationId: this.scope.organizationFilter(user),
    }

    const grouped = await this.prisma.leaseCase.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    })

    const byStatus = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]))

    return {
      total: grouped.reduce((sum, row) => sum + row._count._all, 0),
      byStatus,
      pending: grouped
        .filter((row) => row.status !== LeaseStatus.FAOL && row.status !== LeaseStatus.RAD_ETILDI)
        .reduce((sum, row) => sum + row._count._all, 0),
      newCount: byStatus[LeaseStatus.YANGI] ?? 0,
    }
  }

  private present(item: ApplicationRow) {
    return {
      id: item.id,
      code: item.code,
      tenant: item.organization.name,
      organizationId: item.organizationId,
      buildingId: item.buildingId,
      buildingName: item.building.name,
      unitId: item.unitId,
      unitCode: item.unit.code,
      area: toNumber(item.unit.area),
      type: item.requestType,
      price: toNumber(item.commercialOffer?.monthlyRent ?? item.offerPrice),
      stage: stageOf(item.status),
      status: item.applicationStatus,
      leaseStatus: item.status,
      submittedAt: item.submittedAt.toISOString(),
      contactPerson: item.contactPerson,
      phone: item.contactPhone,
      note: item.note,
      contactedAt: item.contactedAt?.toISOString() ?? null,
      rejectReason: item.rejectReason,
    }
  }
}
