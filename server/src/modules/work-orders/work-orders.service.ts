import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  MaterialStatus,
  Prisma,
  ServiceStatus,
  StockMovementKind,
  WorkOrderStatus,
} from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { AuditService } from '../audit/audit.service'
import { pageResult } from '../../common/dto/pagination.dto'
import { nextCode } from '../../common/utils/codes'
import { formatMoney, toNumber } from '../../common/utils/money'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type {
  CompleteWorkOrderDto,
  CreateMaterialRequestDto,
  MaterialRequestQueryDto,
  RejectMaterialRequestDto,
  UpdateWorkOrderProgressDto,
  WorkOrderQueryDto,
} from './dto/work-order.dto'

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Ish topshiriqlari

  async list(user: AuthenticatedUser, query: WorkOrderQueryDto) {
    const where: Prisma.WorkOrderWhereInput = {
      buildingId: this.scope.buildingFilterFor(user, query.buildingId),
      status: query.status,
      assigneeId: query.mine === 'true' ? user.id : undefined,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        include: { building: true, serviceRequest: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.workOrder.count({ where }),
    ])

    return pageResult(
      items.map((order) => ({
        id: order.id,
        code: order.code,
        title: order.title,
        status: order.status,
        buildingId: order.buildingId,
        buildingName: order.building.name,
        serviceRequestCode: order.serviceRequest?.code ?? null,
        assignee: order.assigneeName,
        progress: order.progress,
        dueAt: order.dueAt?.toISOString().slice(0, 10) ?? null,
        startedAt: order.startedAt?.toISOString() ?? null,
        completedAt: order.completedAt?.toISOString() ?? null,
        checklist: order.checklist,
      })),
      total,
      query,
    )
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const order = await this.prisma.workOrder.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: {
        building: true,
        serviceRequest: true,
        materialRequests: { include: { lines: true } },
        documents: true,
      },
    })
    if (!order) throw new NotFoundException('Ish topshirig‘i topilmadi')
    this.scope.assertBuilding(user, order.buildingId)

    return {
      id: order.id,
      code: order.code,
      title: order.title,
      status: order.status,
      buildingId: order.buildingId,
      buildingName: order.building.name,
      serviceRequest: order.serviceRequest
        ? { id: order.serviceRequest.id, code: order.serviceRequest.code }
        : null,
      assignee: order.assigneeName,
      progress: order.progress,
      checklist: order.checklist,
      resultNote: order.resultNote,
      dueAt: order.dueAt?.toISOString().slice(0, 10) ?? null,
      materials: order.materialRequests.map((request) => ({
        id: request.id,
        code: request.code,
        status: request.status,
        amount: toNumber(request.amount),
        items: request.itemCount,
        lines: request.lines.map((line) => ({
          name: line.name,
          unit: line.unit,
          qty: toNumber(line.qty),
          price: toNumber(line.price),
          sum: toNumber(line.sum),
        })),
      })),
    }
  }

  async start(user: AuthenticatedUser, id: string) {
    const order = await this.require(user, id)
    if (order.status === WorkOrderStatus.COMPLETED) {
      throw new ConflictException({
        message: 'Yakunlangan topshiriqni qayta boshlab bo‘lmaydi',
        reason: 'INVALID_STATE',
      })
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: order.id },
        data: { status: WorkOrderStatus.IN_PROGRESS, startedAt: new Date() },
      })
      if (order.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: order.serviceRequestId },
          data: { status: ServiceStatus.IN_PROGRESS },
        })
      }
      await this.audit.record(
        {
          actor: user,
          action: 'Ish boshlandi',
          entityType: 'workOrder',
          entityId: order.id,
          detail: order.code,
        },
        tx,
      )
    })

    return this.findOne(user, order.id)
  }

  async updateProgress(user: AuthenticatedUser, id: string, dto: UpdateWorkOrderProgressDto) {
    const order = await this.require(user, id)

    await this.prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: order.id },
        data: {
          progress: dto.progress,
          checklist: dto.checklist
            ? (dto.checklist as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      })
      if (order.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: order.serviceRequestId },
          data: { progress: dto.progress },
        })
      }
      await this.audit.record(
        {
          actor: user,
          action: 'Ish jarayoni yangilandi',
          entityType: 'workOrder',
          entityId: order.id,
          detail: dto.note ?? `${dto.progress}%`,
        },
        tx,
      )
    })

    return this.findOne(user, order.id)
  }

  async complete(user: AuthenticatedUser, id: string, dto: CompleteWorkOrderDto) {
    const order = await this.require(user, id)

    await this.prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: order.id },
        data: {
          status: WorkOrderStatus.COMPLETED,
          progress: 100,
          completedAt: new Date(),
          resultNote: dto.resultNote,
        },
      })
      if (order.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: order.serviceRequestId },
          data: { status: ServiceStatus.TENANT_CONFIRMATION, progress: 100 },
        })
      }
      await this.audit.record(
        {
          actor: user,
          action: 'Ish yakunlandi',
          entityType: 'workOrder',
          entityId: order.id,
          detail: dto.resultNote,
        },
        tx,
      )
    })

    return this.findOne(user, order.id)
  }

  // -------------------------------------------------------------------------
  // Material so‘rovlari

  async listMaterialRequests(user: AuthenticatedUser, query: MaterialRequestQueryDto) {
    const where: Prisma.MaterialRequestWhereInput = {
      status: query.status,
      warehouseId: this.scope.warehouseFilterFor(user, query.warehouseId),
      buildingId: this.scope.buildingFilter(user),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { workOrderCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.materialRequest.findMany({
        where,
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.materialRequest.count({ where }),
    ])

    return pageResult(
      items.map((request) => ({
        id: request.id,
        code: request.code,
        workOrder: request.workOrderCode,
        requester: request.requesterName,
        items: request.itemCount,
        amount: toNumber(request.amount),
        status: request.status,
        createdAt: request.createdAt.toISOString().slice(0, 10),
        buildingName: request.buildingName,
        lines: request.lines.map((line) => ({
          name: line.name,
          unit: line.unit,
          qty: toNumber(line.qty),
          price: toNumber(line.price),
          sum: toNumber(line.sum),
        })),
      })),
      total,
      query,
    )
  }

  async createMaterialRequest(user: AuthenticatedUser, dto: CreateMaterialRequestDto) {
    const order = await this.require(user, dto.workOrderId)
    const building = await this.prisma.building.findUniqueOrThrow({
      where: { id: order.buildingId },
    })

    const lines = dto.lines.map((line) => ({
      warehouseItemId: line.warehouseItemId,
      name: line.name,
      unit: line.unit,
      qty: new Prisma.Decimal(line.qty),
      price: new Prisma.Decimal(line.price),
      sum: new Prisma.Decimal(Math.round(line.qty * line.price)),
    }))
    const amount = lines.reduce((sum, line) => sum + toNumber(line.sum), 0)

    const last = await this.prisma.materialRequest.findFirst({
      where: { code: { startsWith: `MT-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.materialRequest.create({
        data: {
          code: nextCode('MT', new Date().getFullYear(), last?.code),
          workOrderId: order.id,
          workOrderCode: order.code,
          buildingId: order.buildingId,
          buildingName: building.name,
          requesterId: user.id,
          requesterName: user.fullName,
          warehouseId: dto.warehouseId,
          status: MaterialStatus.SUBMITTED,
          itemCount: lines.length,
          amount: new Prisma.Decimal(amount),
          lines: { createMany: { data: lines } },
        },
      })

      await tx.workOrder.update({
        where: { id: order.id },
        data: { status: WorkOrderStatus.MATERIAL_PENDING },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Material so‘rovi yuborildi',
          entityType: 'materialRequest',
          entityId: request.id,
          detail: `${request.code}, ${lines.length} ta pozitsiya, ${formatMoney(amount)}`,
        },
        tx,
      )

      return request
    })

    return { id: created.id, code: created.code, status: created.status }
  }

  async approveMaterialRequest(user: AuthenticatedUser, id: string) {
    const request = await this.prisma.materialRequest.findUnique({ where: { id } })
    if (!request) throw new NotFoundException('Material so‘rovi topilmadi')
    if (request.status !== MaterialStatus.SUBMITTED) {
      throw new ConflictException({
        message: 'Faqat yuborilgan so‘rovni tasdiqlash mumkin',
        reason: 'INVALID_STATE',
        current: request.status,
      })
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.materialRequest.update({
        where: { id },
        data: { status: MaterialStatus.APPROVED, approvedById: user.id, approvedAt: new Date() },
      })
      await this.audit.record(
        {
          actor: user,
          action: 'Material so‘rovi tasdiqlandi',
          entityType: 'materialRequest',
          entityId: id,
          detail: request.code,
        },
        tx,
      )
    })

    return { id, status: MaterialStatus.APPROVED }
  }

  async rejectMaterialRequest(user: AuthenticatedUser, id: string, dto: RejectMaterialRequestDto) {
    const request = await this.prisma.materialRequest.findUnique({ where: { id } })
    if (!request) throw new NotFoundException('Material so‘rovi topilmadi')

    await this.prisma.$transaction(async (tx) => {
      await tx.materialRequest.update({
        where: { id },
        data: { status: MaterialStatus.REJECTED, rejectReason: dto.reason },
      })
      await this.audit.record(
        {
          actor: user,
          action: 'Material so‘rovi rad etildi',
          entityType: 'materialRequest',
          entityId: id,
          detail: dto.reason,
        },
        tx,
      )
    })

    return { id, status: MaterialStatus.REJECTED }
  }

  /** Omborchi materialni beradi: qoldiq kamayadi va harakat yoziladi. */
  async issueMaterialRequest(user: AuthenticatedUser, id: string) {
    const request = await this.prisma.materialRequest.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!request) throw new NotFoundException('Material so‘rovi topilmadi')
    if (request.warehouseId) this.scope.assertWarehouse(user, request.warehouseId)
    if (request.status !== MaterialStatus.APPROVED) {
      throw new ConflictException({
        message: 'Faqat tasdiqlangan so‘rov bo‘yicha material beriladi',
        reason: 'INVALID_STATE',
        current: request.status,
      })
    }

    const last = await this.prisma.stockMovement.findFirst({
      where: { code: { startsWith: `SM-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    let sequence = last?.code

    await this.prisma.$transaction(async (tx) => {
      for (const line of request.lines) {
        if (!line.warehouseItemId) continue
        const item = await tx.warehouseItem.findUniqueOrThrow({
          where: { id: line.warehouseItemId },
        })
        const qty = toNumber(line.qty)
        if (toNumber(item.qty) < qty) {
          throw new ConflictException({
            message: `${item.name} bo‘yicha qoldiq yetarli emas`,
            reason: 'STOCK_NOT_ENOUGH',
            itemCode: item.code,
          })
        }

        const code = nextCode('SM', new Date().getFullYear(), sequence, 5)
        sequence = code

        await tx.warehouseItem.update({
          where: { id: item.id },
          data: { qty: new Prisma.Decimal(toNumber(item.qty) - qty) },
        })

        await tx.stockMovement.create({
          data: {
            code,
            warehouseItemId: item.id,
            warehouseId: item.warehouseId,
            kind: StockMovementKind.OUTBOUND,
            qty: new Prisma.Decimal(qty),
            price: line.price,
            sum: line.sum,
            waybillNumber: request.code,
            reason: `${request.workOrderCode} bo‘yicha material berildi`,
            materialRequestId: request.id,
            performedById: user.id,
          },
        })
      }

      await tx.materialRequest.update({
        where: { id },
        data: { status: MaterialStatus.ISSUED, issuedAt: new Date() },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Material berildi',
          entityType: 'materialRequest',
          entityId: id,
          detail: `${request.code}, ${formatMoney(toNumber(request.amount))}`,
        },
        tx,
      )
    })

    return { id, status: MaterialStatus.ISSUED }
  }

  private async require(user: AuthenticatedUser, id: string) {
    const order = await this.prisma.workOrder.findFirst({ where: { OR: [{ id }, { code: id }] } })
    if (!order) throw new NotFoundException('Ish topshirig‘i topilmadi')
    this.scope.assertBuilding(user, order.buildingId)
    return order
  }
}
