import { Injectable, NotFoundException } from '@nestjs/common'
import { MeterStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { AuditService } from '../audit/audit.service'
import { pageResult } from '../../common/dto/pagination.dto'
import { parseIsoDate } from '../../common/utils/dates'
import { toNumber } from '../../common/utils/money'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type { CreateMeterReadingDto, MeterQueryDto } from './dto/meter.dto'

@Injectable()
export class MetersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: MeterQueryDto) {
    const where: Prisma.MeterWhereInput = {
      buildingId: this.scope.buildingFilterFor(user, query.buildingId),
      type: query.type,
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { serial: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.meter.findMany({
        where,
        include: { building: true },
        orderBy: { code: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.meter.count({ where }),
    ])

    return pageResult(items.map((meter) => this.present(meter)), total, query)
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const meter = await this.prisma.meter.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: { building: true },
    })
    if (!meter) throw new NotFoundException('Hisoblagich topilmadi')
    this.scope.assertBuilding(user, meter.buildingId)
    return this.present(meter)
  }

  async readings(user: AuthenticatedUser, id: string) {
    const meter = await this.require(user, id)
    const readings = await this.prisma.meterReading.findMany({
      where: { meterId: meter.id },
      orderBy: { readAt: 'desc' },
      take: 60,
    })

    return readings.map((reading) => ({
      id: reading.id,
      value: toNumber(reading.value),
      previousValue: toNumber(reading.previousValue),
      consumption: toNumber(reading.consumption),
      readAt: reading.readAt.toISOString().slice(0, 10),
      note: reading.note,
    }))
  }

  /** Yangi ko‘rsatkich: sarf oldingi qiymatga nisbatan hisoblanadi. */
  async addReading(user: AuthenticatedUser, id: string, dto: CreateMeterReadingDto) {
    const meter = await this.require(user, id)
    const previous = toNumber(meter.lastReading)

    const reading = await this.prisma.$transaction(async (tx) => {
      const created = await tx.meterReading.create({
        data: {
          meterId: meter.id,
          value: new Prisma.Decimal(dto.value),
          previousValue: new Prisma.Decimal(previous),
          consumption: new Prisma.Decimal(Math.max(0, dto.value - previous)),
          readAt: parseIsoDate(dto.readAt),
          recordedById: user.id,
          note: dto.note ?? '',
        },
      })

      await tx.meter.update({
        where: { id: meter.id },
        data: {
          previousReading: new Prisma.Decimal(previous),
          lastReading: new Prisma.Decimal(dto.value),
          readAt: parseIsoDate(dto.readAt),
        },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Hisoblagich ko‘rsatkichi kiritildi',
          entityType: 'meter',
          entityId: meter.id,
          detail: `${meter.code}: ${dto.value} ${meter.measureUnit}`,
        },
        tx,
      )

      return created
    })

    return {
      id: reading.id,
      value: toNumber(reading.value),
      consumption: toNumber(reading.consumption),
    }
  }

  /** Kommunal sarf yig‘masi, tur bo‘yicha. */
  async utilitySummary(user: AuthenticatedUser) {
    const meters = await this.prisma.meter.findMany({
      where: { buildingId: this.scope.buildingFilter(user), status: MeterStatus.ACTIVE },
    })

    const byType = new Map<string, { value: number; consumption: number; unit: string }>()
    for (const meter of meters) {
      const current = byType.get(meter.type) ?? {
        value: 0,
        consumption: 0,
        unit: meter.measureUnit,
      }
      current.value += toNumber(meter.lastReading)
      current.consumption += toNumber(meter.lastReading) - toNumber(meter.previousReading)
      byType.set(meter.type, current)
    }

    return [...byType.entries()].map(([label, row]) => ({
      label,
      value: row.value,
      unit: row.unit,
      consumption: row.consumption,
    }))
  }

  private async require(user: AuthenticatedUser, id: string) {
    const meter = await this.prisma.meter.findFirst({ where: { OR: [{ id }, { code: id }] } })
    if (!meter) throw new NotFoundException('Hisoblagich topilmadi')
    this.scope.assertBuilding(user, meter.buildingId)
    return meter
  }

  private present(meter: Prisma.MeterGetPayload<{ include: { building: true } }>) {
    return {
      id: meter.id,
      code: meter.code,
      type: meter.type,
      serial: meter.serial,
      buildingId: meter.buildingId,
      buildingName: meter.building.name,
      location: meter.location,
      unit: meter.measureUnit,
      lastReading: toNumber(meter.lastReading),
      previousReading: toNumber(meter.previousReading),
      readAt: meter.readAt?.toISOString().slice(0, 10) ?? null,
      verifyAt: meter.verifyAt?.toISOString().slice(0, 10) ?? null,
      status: meter.status,
    }
  }
}
