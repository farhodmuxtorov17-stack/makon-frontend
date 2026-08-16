import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InventorySessionStatus, Prisma, StockMovementKind } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { AuditService } from '../audit/audit.service'
import { pageResult } from '../../common/dto/pagination.dto'
import { nextCode } from '../../common/utils/codes'
import { toNumber } from '../../common/utils/money'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type {
  CreateInventorySessionDto,
  CreateStockMovementDto,
  StockMovementQueryDto,
  SubmitInventoryCountDto,
  WarehouseItemQueryDto,
} from './dto/warehouse.dto'

@Injectable()
export class WarehouseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  async listWarehouses(user: AuthenticatedUser) {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: this.scope.warehouseFilter(user) },
      orderBy: { name: 'asc' },
    })
    return warehouses.map((warehouse) => ({
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      buildingId: warehouse.buildingId,
      address: warehouse.address,
      isActive: warehouse.isActive,
    }))
  }

  /** Ombor qoldig‘i, omborchi faqat o‘ziga biriktirilgan omborni ko‘radi. */
  async listItems(user: AuthenticatedUser, query: WarehouseItemQueryDto) {
    const where: Prisma.WarehouseItemWhereInput = {
      warehouseId: this.scope.warehouseFilterFor(user, query.warehouseId),
      category: query.category,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.warehouseItem.findMany({
        where,
        include: { warehouse: true },
        orderBy: { code: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.warehouseItem.count({ where }),
    ])

    const rows = items
      .map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        qty: toNumber(item.qty),
        minQty: toNumber(item.minQty),
        price: toNumber(item.price),
        warehouseId: item.warehouseId,
        warehouse: item.warehouse.name,
        addedAt: item.addedAt.toISOString().slice(0, 10),
        lowStock: toNumber(item.qty) < toNumber(item.minQty),
      }))
      .filter((item) => (query.lowStock === 'true' ? item.lowStock : true))

    return pageResult(rows, total, query)
  }

  async findItem(user: AuthenticatedUser, id: string) {
    const item = await this.prisma.warehouseItem.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: { warehouse: true, movements: { orderBy: { occurredAt: 'desc' }, take: 20 } },
    })
    if (!item) throw new NotFoundException('Ombor pozitsiyasi topilmadi')
    this.scope.assertWarehouse(user, item.warehouseId)

    return {
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      qty: toNumber(item.qty),
      minQty: toNumber(item.minQty),
      price: toNumber(item.price),
      warehouse: item.warehouse.name,
      movements: item.movements.map((movement) => ({
        id: movement.id,
        code: movement.code,
        kind: movement.kind,
        qty: toNumber(movement.qty),
        sum: toNumber(movement.sum),
        waybillNumber: movement.waybillNumber,
        reason: movement.reason,
        occurredAt: movement.occurredAt.toISOString(),
      })),
    }
  }

  async listMovements(user: AuthenticatedUser, query: StockMovementQueryDto) {
    const where: Prisma.StockMovementWhereInput = {
      warehouseId: this.scope.warehouseFilterFor(user, query.warehouseId),
      kind: query.kind,
      ...(query.search ? { code: { contains: query.search, mode: 'insensitive' } } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: { warehouseItem: true, warehouse: true },
        orderBy: { occurredAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ])

    return pageResult(
      items.map((movement) => ({
        id: movement.id,
        code: movement.code,
        kind: movement.kind,
        itemName: movement.warehouseItem.name,
        itemCode: movement.warehouseItem.code,
        warehouse: movement.warehouse.name,
        qty: toNumber(movement.qty),
        price: toNumber(movement.price),
        sum: toNumber(movement.sum),
        waybillNumber: movement.waybillNumber,
        reason: movement.reason,
        occurredAt: movement.occurredAt.toISOString(),
      })),
      total,
      query,
    )
  }

  /** Kirim yoki chiqim harakati, qoldiq darhol yangilanadi. */
  async createMovement(user: AuthenticatedUser, dto: CreateStockMovementDto) {
    const item = await this.prisma.warehouseItem.findUnique({
      where: { id: dto.warehouseItemId },
    })
    if (!item) throw new NotFoundException('Ombor pozitsiyasi topilmadi')
    this.scope.assertWarehouse(user, item.warehouseId)

    const current = toNumber(item.qty)
    const delta =
      dto.kind === StockMovementKind.INBOUND || dto.kind === StockMovementKind.ADJUSTMENT
        ? dto.qty
        : -dto.qty

    if (current + delta < 0) {
      throw new ConflictException({
        message: 'Qoldiq yetarli emas',
        reason: 'STOCK_NOT_ENOUGH',
        available: current,
      })
    }

    const last = await this.prisma.stockMovement.findFirst({
      where: { code: { startsWith: `SM-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stockMovement.create({
        data: {
          code: nextCode('SM', new Date().getFullYear(), last?.code, 5),
          warehouseItemId: item.id,
          warehouseId: item.warehouseId,
          kind: dto.kind,
          qty: new Prisma.Decimal(dto.qty),
          price: item.price,
          sum: new Prisma.Decimal(Math.round(dto.qty * toNumber(item.price))),
          waybillNumber: dto.waybillNumber,
          reason: dto.reason ?? '',
          performedById: user.id,
        },
      })

      await tx.warehouseItem.update({
        where: { id: item.id },
        data: { qty: new Prisma.Decimal(current + delta) },
      })

      await this.audit.record(
        {
          actor: user,
          action: dto.kind === StockMovementKind.INBOUND ? 'Ombor kirimi' : 'Ombor chiqimi',
          entityType: 'stockMovement',
          entityId: created.id,
          detail: `${item.name}, ${dto.qty} ${item.unit}`,
        },
        tx,
      )

      return created
    })

    return { id: movement.id, code: movement.code, balance: current + delta }
  }

  /** Ombor bo‘limining yig‘ma ko‘rsatkichlari. */
  async summary(user: AuthenticatedUser) {
    const warehouseFilter = this.scope.warehouseFilter(user)
    const [items, inbound, outbound, warehouses] = await Promise.all([
      this.prisma.warehouseItem.findMany({ where: { warehouseId: warehouseFilter } }),
      this.prisma.stockMovement.count({
        where: { warehouseId: warehouseFilter, kind: StockMovementKind.INBOUND },
      }),
      this.prisma.stockMovement.count({
        where: { warehouseId: warehouseFilter, kind: StockMovementKind.OUTBOUND },
      }),
      this.prisma.warehouse.count({ where: { id: warehouseFilter } }),
    ])

    const byCategory = new Map<string, number>()
    for (const item of items) {
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1)
    }

    return {
      inbound,
      outbound,
      balance: Math.round(items.reduce((sum, item) => sum + toNumber(item.qty), 0)),
      warehouses,
      positions: items.length,
      totalValue: items.reduce((sum, item) => sum + toNumber(item.qty) * toNumber(item.price), 0),
      lowStock: items.filter((item) => toNumber(item.qty) < toNumber(item.minQty)).length,
      categories: [...byCategory.entries()].map(([label, count]) => ({ label, count })),
    }
  }

  // -------------------------------------------------------------------------
  // Inventarizatsiya

  async listInventorySessions(user: AuthenticatedUser) {
    const sessions = await this.prisma.inventorySession.findMany({
      where: { warehouseId: this.scope.warehouseFilter(user) },
      include: { warehouse: true, _count: { select: { lines: true } } },
      orderBy: { startedAt: 'desc' },
    })

    return sessions.map((session) => ({
      id: session.id,
      code: session.code,
      warehouse: session.warehouse.name,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      closedAt: session.closedAt?.toISOString() ?? null,
      lines: session._count.lines,
      note: session.note,
    }))
  }

  async openInventorySession(user: AuthenticatedUser, dto: CreateInventorySessionDto) {
    this.scope.assertWarehouse(user, dto.warehouseId)

    const open = await this.prisma.inventorySession.findFirst({
      where: { warehouseId: dto.warehouseId, status: { not: InventorySessionStatus.CLOSED } },
    })
    if (open) {
      throw new ConflictException({
        message: 'Bu omborda ochiq inventarizatsiya mavjud',
        reason: 'SESSION_ALREADY_OPEN',
        sessionId: open.id,
      })
    }

    const last = await this.prisma.inventorySession.findFirst({
      where: { code: { startsWith: `INV-S-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    const session = await this.prisma.inventorySession.create({
      data: {
        code: nextCode('INV-S', new Date().getFullYear(), last?.code),
        warehouseId: dto.warehouseId,
        status: InventorySessionStatus.OPEN,
        startedById: user.id,
        note: dto.note ?? '',
      },
    })

    await this.audit.record({
      actor: user,
      action: 'Inventarizatsiya boshlandi',
      entityType: 'inventorySession',
      entityId: session.id,
      detail: session.code,
    })

    return { id: session.id, code: session.code, status: session.status }
  }

  /** Sanoq natijalari kiritiladi va farq hisoblanadi. */
  async submitCount(user: AuthenticatedUser, id: string, dto: SubmitInventoryCountDto) {
    const session = await this.prisma.inventorySession.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Inventarizatsiya topilmadi')
    this.scope.assertWarehouse(user, session.warehouseId)
    if (session.status === InventorySessionStatus.CLOSED) {
      throw new ConflictException({ message: 'Inventarizatsiya yopilgan', reason: 'INVALID_STATE' })
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        const item = await tx.warehouseItem.findUniqueOrThrow({
          where: { id: line.warehouseItemId },
        })
        const expected = toNumber(item.qty)
        await tx.inventoryLine.upsert({
          where: {
            sessionId_warehouseItemId: { sessionId: id, warehouseItemId: line.warehouseItemId },
          },
          create: {
            sessionId: id,
            warehouseItemId: line.warehouseItemId,
            expectedQty: new Prisma.Decimal(expected),
            countedQty: new Prisma.Decimal(line.countedQty),
            difference: new Prisma.Decimal(line.countedQty - expected),
            note: line.note ?? '',
          },
          update: {
            expectedQty: new Prisma.Decimal(expected),
            countedQty: new Prisma.Decimal(line.countedQty),
            difference: new Prisma.Decimal(line.countedQty - expected),
            note: line.note ?? '',
          },
        })
      }

      await tx.inventorySession.update({
        where: { id },
        data: { status: InventorySessionStatus.COUNTING },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Inventarizatsiya sanog‘i kiritildi',
          entityType: 'inventorySession',
          entityId: id,
          detail: `${dto.lines.length} ta pozitsiya`,
        },
        tx,
      )
    })

    return this.inventoryDetails(user, id)
  }

  /**
   * Inventarizatsiyani yopish: farqlar tuzatish harakati sifatida yoziladi.
   * TODO(backend): farqni hisobdan chiqarish uchun tasdiqlash oqimi qo‘shiladi.
   */
  async closeInventorySession(user: AuthenticatedUser, id: string) {
    const session = await this.prisma.inventorySession.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!session) throw new NotFoundException('Inventarizatsiya topilmadi')
    this.scope.assertWarehouse(user, session.warehouseId)

    await this.prisma.$transaction(async (tx) => {
      for (const line of session.lines) {
        if (toNumber(line.difference) === 0) continue
        await tx.warehouseItem.update({
          where: { id: line.warehouseItemId },
          data: { qty: line.countedQty },
        })
      }

      await tx.inventorySession.update({
        where: { id },
        data: { status: InventorySessionStatus.CLOSED, closedAt: new Date() },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Inventarizatsiya yopildi',
          entityType: 'inventorySession',
          entityId: id,
          detail: `${session.lines.length} ta pozitsiya bo‘yicha qoldiq moslashtirildi`,
        },
        tx,
      )
    })

    return this.inventoryDetails(user, id)
  }

  async inventoryDetails(user: AuthenticatedUser, id: string) {
    const session = await this.prisma.inventorySession.findUnique({
      where: { id },
      include: { warehouse: true, lines: { include: { warehouseItem: true } } },
    })
    if (!session) throw new NotFoundException('Inventarizatsiya topilmadi')
    this.scope.assertWarehouse(user, session.warehouseId)

    return {
      id: session.id,
      code: session.code,
      warehouse: session.warehouse.name,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      closedAt: session.closedAt?.toISOString() ?? null,
      lines: session.lines.map((line) => ({
        itemCode: line.warehouseItem.code,
        itemName: line.warehouseItem.name,
        unit: line.warehouseItem.unit,
        expectedQty: toNumber(line.expectedQty),
        countedQty: toNumber(line.countedQty),
        difference: toNumber(line.difference),
        note: line.note,
      })),
    }
  }
}
