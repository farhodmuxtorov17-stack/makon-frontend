import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, UnitStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { AuditService } from '../audit/audit.service'
import { pageResult } from '../../common/dto/pagination.dto'
import { toNumber } from '../../common/utils/money'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type { BuildingQueryDto, UpdateBuildingDto } from './dto/building.dto'

@Injectable()
export class BuildingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Ro‘yxat ko‘rish sohasi bilan cheklanadi: bino rahbari boshqa binoni
   * so‘rasa ham, so‘rov shartiga uning binolari qo‘yiladi.
   */
  async list(user: AuthenticatedUser, query: BuildingQueryDto) {
    const where: Prisma.BuildingWhereInput = {
      id: this.scope.buildingFilter(user),
      status: query.status,
      type: query.type,
      city: query.city,
      district: query.district,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { street: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.building.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.building.count({ where }),
    ])

    return pageResult(items.map((item) => this.present(item)), total, query)
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const building = await this.prisma.building.findFirst({
      where: { OR: [{ id }, { slug: id }, { code: id }] },
    })
    if (!building) throw new NotFoundException('Obyekt topilmadi')
    this.scope.assertBuilding(user, building.id)
    return this.present(building)
  }

  async floors(user: AuthenticatedUser, id: string) {
    this.scope.assertBuilding(user, id)
    return this.prisma.floor.findMany({
      where: { buildingId: id },
      orderBy: { level: 'asc' },
      include: { _count: { select: { units: true } } },
    })
  }

  /** Bandlik ko‘rsatkichlari unit reyestridan qayta hisoblanadi. */
  async stats(user: AuthenticatedUser, id: string) {
    this.scope.assertBuilding(user, id)
    const building = await this.prisma.building.findUnique({ where: { id } })
    if (!building) throw new NotFoundException('Obyekt topilmadi')

    const grouped = await this.prisma.unit.groupBy({
      by: ['status'],
      where: { buildingId: id },
      _count: { _all: true },
      _sum: { area: true },
    })

    const byStatus = Object.fromEntries(
      grouped.map((row) => [
        row.status,
        { count: row._count._all, area: toNumber(row._sum.area) },
      ]),
    )

    const vacant = byStatus[UnitStatus.VACANT] ?? { count: 0, area: 0 }
    const rented = byStatus[UnitStatus.RENTED] ?? { count: 0, area: 0 }
    const gla = toNumber(building.gla)

    return {
      buildingId: building.id,
      gla,
      units: building.unitCount,
      occupiedUnits: building.occupiedUnits,
      vacantUnits: building.vacantUnits,
      vacantArea: toNumber(building.vacantArea),
      occupancy: building.occupancy,
      monthlyRevenue: toNumber(building.monthlyRevenue),
      debt: toNumber(building.debt),
      sla: building.sla,
      serviceRequests: building.serviceRequestCount,
      registry: { byStatus, vacant, rented },
    }
  }

  /** Portfel yig‘masi, boshqaruv paneli uchun. */
  async portfolio(user: AuthenticatedUser) {
    const where: Prisma.BuildingWhereInput = { id: this.scope.buildingFilter(user) }
    const buildings = await this.prisma.building.findMany({ where })

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
      sla:
        buildings.length > 0
          ? Math.round(buildings.reduce((sum, item) => sum + item.sla, 0) / buildings.length)
          : 0,
    }
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateBuildingDto) {
    this.scope.assertBuilding(user, id)
    const building = await this.prisma.building.findUnique({ where: { id } })
    if (!building) throw new NotFoundException('Obyekt topilmadi')

    const updated = await this.prisma.building.update({ where: { id }, data: dto })

    await this.audit.record({
      actor: user,
      action: 'Obyekt ma’lumotlari yangilandi',
      entityType: 'building',
      entityId: id,
      detail: Object.keys(dto).join(', '),
    })

    return this.present(updated)
  }

  private present(building: Prisma.BuildingGetPayload<object>) {
    return {
      id: building.id,
      code: building.code,
      name: building.name,
      slug: building.slug,
      type: building.type,
      city: building.city,
      district: building.district,
      street: building.street,
      buildYear: building.buildYear,
      buildingClass: building.buildingClass,
      floors: building.floors,
      undergroundFloors: building.undergroundFloors,
      units: building.unitCount,
      occupiedUnits: building.occupiedUnits,
      vacantUnits: building.vacantUnits,
      gla: toNumber(building.gla),
      vacantArea: toNumber(building.vacantArea),
      occupancy: building.occupancy,
      monthlyRevenue: toNumber(building.monthlyRevenue),
      debt: toNumber(building.debt),
      sla: building.sla,
      serviceRequests: building.serviceRequestCount,
      lat: building.lat,
      lon: building.lon,
      photo: building.photo,
      gallery: building.gallery,
      manager: building.managerName,
      managerPhone: building.managerPhone,
      status: building.status,
      amenities: building.amenities,
      equipment: building.equipment,
    }
  }
}
