import { Injectable } from '@nestjs/common'
import { InvoiceStatus, Prisma, ServiceStatus, UnitStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { toNumber } from '../../common/utils/money'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /** Portfel bo‘yicha asosiy ko‘rsatkichlar. */
  async portfolio(user: AuthenticatedUser) {
    const buildingFilter = this.scope.buildingFilter(user)
    const buildings = await this.prisma.building.findMany({ where: { id: buildingFilter } })

    const gla = buildings.reduce((sum, item) => sum + toNumber(item.gla), 0)
    const vacantArea = buildings.reduce((sum, item) => sum + toNumber(item.vacantArea), 0)

    return {
      buildings: buildings.length,
      gla,
      vacantArea,
      occupancy: gla > 0 ? Math.round(((gla - vacantArea) / gla) * 100) : 0,
      revenue: buildings.reduce((sum, item) => sum + toNumber(item.monthlyRevenue), 0),
      debt: buildings.reduce((sum, item) => sum + toNumber(item.debt), 0),
      units: buildings.reduce((sum, item) => sum + item.unitCount, 0),
      vacantUnits: buildings.reduce((sum, item) => sum + item.vacantUnits, 0),
      rows: buildings.map((item) => ({
        id: item.id,
        name: item.name,
        occupancy: item.occupancy,
        revenue: toNumber(item.monthlyRevenue),
        debt: toNumber(item.debt),
        sla: item.sla,
        vacantUnits: item.vacantUnits,
      })),
    }
  }

  /** Obyektlar kesimida bandlik. */
  async occupancy(user: AuthenticatedUser) {
    const buildingFilter = this.scope.buildingFilter(user)
    const grouped = await this.prisma.unit.groupBy({
      by: ['buildingId', 'status'],
      where: { buildingId: buildingFilter },
      _count: { _all: true },
      _sum: { area: true },
    })

    const buildings = await this.prisma.building.findMany({ where: { id: buildingFilter } })

    return buildings.map((building) => {
      const rows = grouped.filter((row) => row.buildingId === building.id)
      const total = rows.reduce((sum, row) => sum + row._count._all, 0)
      const rented = rows
        .filter((row) => row.status === UnitStatus.RENTED || row.status === UnitStatus.SOLD)
        .reduce((sum, row) => sum + row._count._all, 0)

      return {
        buildingId: building.id,
        buildingName: building.name,
        totalUnits: total,
        rentedUnits: rented,
        vacantUnits: rows
          .filter((row) => row.status === UnitStatus.VACANT)
          .reduce((sum, row) => sum + row._count._all, 0),
        occupancy: total > 0 ? Math.round((rented / total) * 100) : 0,
        byStatus: rows.map((row) => ({
          status: row.status,
          count: row._count._all,
          area: toNumber(row._sum.area),
        })),
      }
    })
  }

  /** Tushum va qarzdorlik dinamikasi, davr kesimida. */
  async revenue(user: AuthenticatedUser) {
    const where: Prisma.InvoiceWhereInput = {
      buildingId: this.scope.buildingFilter(user),
      status: { not: InvoiceStatus.CANCELLED },
    }

    const grouped = await this.prisma.invoice.groupBy({
      by: ['periodLabel'],
      where,
      _sum: { total: true, paid: true },
      _count: { _all: true },
    })

    return grouped
      .map((row) => ({
        period: row.periodLabel,
        invoices: row._count._all,
        charged: toNumber(row._sum.total),
        paid: toNumber(row._sum.paid),
        debt: Math.max(0, toNumber(row._sum.total) - toNumber(row._sum.paid)),
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }

  /** Servis desk ko‘rsatkichlari, hisobot sahifasi uchun. */
  async serviceKpi(user: AuthenticatedUser) {
    const where: Prisma.ServiceRequestWhereInput = {
      buildingId: this.scope.buildingFilter(user),
    }

    const [grouped, breached, byCategory] = await Promise.all([
      this.prisma.serviceRequest.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.serviceRequest.count({ where: { ...where, slaBreached: true } }),
      this.prisma.serviceRequest.groupBy({ by: ['category'], where, _count: { _all: true } }),
    ])

    const total = grouped.reduce((sum, row) => sum + row._count._all, 0)
    const byStatus = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]))

    return {
      total,
      newCount: byStatus[ServiceStatus.NEW] ?? 0,
      inProgress: byStatus[ServiceStatus.IN_PROGRESS] ?? 0,
      completed: byStatus[ServiceStatus.COMPLETED] ?? 0,
      closed: byStatus[ServiceStatus.CLOSED] ?? 0,
      slaBreached: breached,
      slaCompliance: total > 0 ? Math.round(((total - breached) / total) * 100) : 100,
      breakdown: grouped.map((row) => ({
        status: row.status,
        count: row._count._all,
        share: total > 0 ? Math.round((row._count._all / total) * 100) : 0,
      })),
      byCategory: byCategory.map((row) => ({ category: row.category, count: row._count._all })),
    }
  }
}
