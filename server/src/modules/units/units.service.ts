import { Injectable, NotFoundException } from '@nestjs/common'
import { ListingStatus, Prisma, UnitStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { AuditService } from '../audit/audit.service'
import { pageResult } from '../../common/dto/pagination.dto'
import { toNumber } from '../../common/utils/money'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type {
  SavePolygonDto,
  UnitQueryDto,
  UpdateUnitContentDto,
  UpdateUnitTechnicalDto,
} from './dto/unit.dto'

const UNIT_INCLUDE = { polygon: true, building: true } satisfies Prisma.UnitInclude
type UnitFull = Prisma.UnitGetPayload<{ include: typeof UNIT_INCLUDE }>

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: UnitQueryDto) {
    const where = this.buildWhere(query, this.scope.buildingFilterFor(user, query.buildingId))

    const [items, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        include: UNIT_INCLUDE,
        orderBy: [{ buildingId: 'asc' }, { floor: 'desc' }, { code: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.unit.count({ where }),
    ])

    return pageResult(items.map((item) => this.present(item)), total, query)
  }

  /**
   * Ommaviy katalog: faqat e’lon qilingan bo‘sh unitlar.
   * Faollashtirilgan unit shu ro‘yxatdan avtomatik chiqib ketadi.
   */
  async catalog(query: UnitQueryDto) {
    const where: Prisma.UnitWhereInput = {
      ...this.buildWhere(query, query.buildingId ? { equals: query.buildingId } : undefined),
      status: UnitStatus.VACANT,
      listing: ListingStatus.PUBLISHED,
      building: { status: 'ACTIVE' },
    }

    const [items, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        include: UNIT_INCLUDE,
        orderBy: [{ price: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.unit.count({ where }),
    ])

    return pageResult(items.map((item) => this.present(item)), total, query)
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id }, include: UNIT_INCLUDE })
    if (!unit) throw new NotFoundException('Unit topilmadi')
    this.scope.assertBuilding(user, unit.buildingId)
    return this.present(unit)
  }

  /** Katalogdagi bitta unit, kirmagan foydalanuvchiga ham ochiq. */
  async publicOne(id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, listing: ListingStatus.PUBLISHED },
      include: UNIT_INCLUDE,
    })
    if (!unit) throw new NotFoundException('Unit topilmadi')
    return this.present(unit)
  }

  async floorUnits(user: AuthenticatedUser, buildingId: string, floor: number) {
    this.scope.assertBuilding(user, buildingId)
    const units = await this.prisma.unit.findMany({
      where: { buildingId, floor },
      include: UNIT_INCLUDE,
      orderBy: { code: 'asc' },
    })
    return units.map((unit) => this.present(unit))
  }

  async updateTechnical(user: AuthenticatedUser, id: string, dto: UpdateUnitTechnicalDto) {
    const unit = await this.requireUnit(user, id)

    const updated = await this.prisma.unit.update({
      where: { id },
      data: {
        status: dto.status,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        equipment: dto.equipment,
      },
      include: UNIT_INCLUDE,
    })

    await this.audit.record({
      actor: user,
      action: 'Unit texnik ma’lumotlari yangilandi',
      entityType: 'unit',
      entityId: id,
      detail: `${unit.code}: ${Object.keys(dto).join(', ')}`,
      meta: { from: unit.status, to: updated.status },
    })

    return this.present(updated)
  }

  async updateContent(user: AuthenticatedUser, id: string, dto: UpdateUnitContentDto) {
    const unit = await this.requireUnit(user, id)

    const updated = await this.prisma.unit.update({
      where: { id },
      data: dto,
      include: UNIT_INCLUDE,
    })

    await this.audit.record({
      actor: user,
      action: 'Unit atributlari yangilandi',
      entityType: 'unit',
      entityId: id,
      detail: `${unit.code}: ${Object.keys(dto).join(', ')}`,
    })

    return this.present(updated)
  }

  /** Qavat rejasidagi ko‘pburchak, kontent operatori chizadi. */
  async savePolygon(user: AuthenticatedUser, id: string, dto: SavePolygonDto) {
    const unit = await this.requireUnit(user, id)
    const points = dto.points.map((point) => [point.x, point.y])

    await this.prisma.unitPolygon.upsert({
      where: { unitId: id },
      create: { unitId: id, points, authorId: user.id },
      update: { points, authorId: user.id },
    })

    await this.audit.record({
      actor: user,
      action: 'Qavat rejasidagi ko‘pburchak saqlandi',
      entityType: 'unit',
      entityId: id,
      detail: `${unit.code}: ${points.length} ta nuqta`,
    })

    return this.findOne(user, id)
  }

  private async requireUnit(user: AuthenticatedUser, id: string): Promise<UnitFull> {
    const unit = await this.prisma.unit.findUnique({ where: { id }, include: UNIT_INCLUDE })
    if (!unit) throw new NotFoundException('Unit topilmadi')
    this.scope.assertBuilding(user, unit.buildingId)
    return unit
  }

  private buildWhere(
    query: UnitQueryDto,
    buildingFilter: Prisma.StringFilter | { in: string[] } | { equals: string } | undefined,
  ): Prisma.UnitWhereInput {
    return {
      buildingId: buildingFilter,
      floor: query.floor,
      status: query.status,
      usage: query.usage,
      offer: query.offer,
      area:
        query.areaFrom !== undefined || query.areaTo !== undefined
          ? { gte: query.areaFrom, lte: query.areaTo }
          : undefined,
      price: query.priceTo !== undefined ? { lte: query.priceTo } : undefined,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { tenantName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }
  }

  private present(unit: UnitFull) {
    return {
      id: unit.id,
      code: unit.code,
      buildingId: unit.buildingId,
      buildingName: unit.building.name,
      buildingSlug: unit.building.slug,
      floor: unit.floor,
      rooms: unit.rooms,
      area: toNumber(unit.area),
      usage: unit.usage,
      offer: unit.offer,
      status: unit.status,
      listing: unit.listing,
      price: toNumber(unit.price),
      priceUnit: unit.priceUnit,
      tenant: unit.tenantName,
      contractCode: unit.contractCode,
      equipment: unit.equipment,
      polygon: (unit.polygon?.points as number[][] | undefined) ?? [],
    }
  }
}
