import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, ServiceStatus, WorkOrderStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { AuditService } from '../audit/audit.service'
import { pageResult } from '../../common/dto/pagination.dto'
import { nextCode } from '../../common/utils/codes'
import { parseIsoDate } from '../../common/utils/dates'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type {
  AssignServiceRequestDto,
  ChangeServiceStatusDto,
  CreateServiceRequestDto,
  ServiceRequestQueryDto,
} from './dto/service-request.dto'

@Injectable()
export class ServiceDeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: ServiceRequestQueryDto) {
    const where: Prisma.ServiceRequestWhereInput = {
      buildingId: this.scope.buildingFilterFor(user, query.buildingId),
      organizationId: this.scope.organizationFilter(user),
      status: query.status,
      category: query.category,
      priority: query.priority,
      slaBreached: query.slaBreached === undefined ? undefined : query.slaBreached === 'true',
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
      this.prisma.serviceRequest.findMany({
        where,
        include: { building: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.serviceRequest.count({ where }),
    ])

    return pageResult(items.map((item) => this.present(item)), total, query)
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: { building: true, workOrders: true, documents: true },
    })
    if (!request) throw new NotFoundException('Servis arizasi topilmadi')
    this.scope.assertBuilding(user, request.buildingId)
    if (request.organizationId) this.scope.assertOrganization(user, request.organizationId)
    return {
      ...this.present(request),
      workOrders: request.workOrders.map((order) => ({
        id: order.id,
        code: order.code,
        status: order.status,
        assigneeName: order.assigneeName,
        progress: order.progress,
      })),
    }
  }

  async create(user: AuthenticatedUser, dto: CreateServiceRequestDto) {
    this.scope.assertBuilding(user, dto.buildingId)

    const last = await this.prisma.serviceRequest.findFirst({
      where: { code: { startsWith: `SR-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.serviceRequest.create({
        data: {
          code: nextCode('SR', new Date().getFullYear(), last?.code),
          title: dto.title,
          category: dto.category,
          buildingId: dto.buildingId,
          unitId: dto.unitId,
          organizationId: this.scope.isTenant(user) ? user.organizationId : undefined,
          unitCode: dto.unitCode,
          requesterName: user.fullName,
          priority: dto.priority,
          status: ServiceStatus.NEW,
          description: dto.description,
          dueAt: dto.dueAt ? parseIsoDate(dto.dueAt) : undefined,
        },
        include: { building: true },
      })

      await tx.building.update({
        where: { id: dto.buildingId },
        data: { serviceRequestCount: { increment: 1 } },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Servis arizasi yaratildi',
          entityType: 'serviceRequest',
          entityId: request.id,
          detail: `${request.code}, ${dto.title}`,
        },
        tx,
      )

      return request
    })

    return this.present(created)
  }

  /** Ko‘rib chiqishga olish: ariza triage bosqichiga o‘tadi. */
  async triage(user: AuthenticatedUser, id: string) {
    const request = await this.require(user, id)
    return this.changeStatus(user, request.id, {
      status: ServiceStatus.TRIAGE,
      progress: Math.max(request.progress, 10),
    })
  }

  /** Ijrochi biriktiriladi va ish topshirig‘i ochiladi. */
  async assign(user: AuthenticatedUser, id: string, dto: AssignServiceRequestDto) {
    const request = await this.require(user, id)
    const assignee = await this.prisma.user.findUnique({ where: { id: dto.assigneeId } })
    if (!assignee) throw new NotFoundException('Ijrochi topilmadi')

    const last = await this.prisma.workOrder.findFirst({
      where: { code: { startsWith: `WO-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { id: request.id },
        data: {
          status: ServiceStatus.ASSIGNED,
          assigneeName: assignee.fullName,
          dueAt: dto.dueAt ? parseIsoDate(dto.dueAt) : request.dueAt,
        },
      })

      await tx.workOrder.create({
        data: {
          code: nextCode('WO', new Date().getFullYear(), last?.code),
          serviceRequestId: request.id,
          buildingId: request.buildingId,
          title: request.title,
          status: WorkOrderStatus.ASSIGNED,
          assigneeId: assignee.id,
          assigneeName: assignee.fullName,
          dueAt: dto.dueAt ? parseIsoDate(dto.dueAt) : request.dueAt,
        },
      })

      await tx.notification.create({
        data: {
          userId: assignee.id,
          title: 'Yangi ish topshirig‘i',
          body: `${request.code}, ${request.title}`,
          category: 'Servis',
          icon: 'wrench',
          link: '/facility/work-orders',
        },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Ijrochi biriktirildi',
          entityType: 'serviceRequest',
          entityId: request.id,
          detail: `${request.code}, ijrochi: ${assignee.fullName}`,
        },
        tx,
      )
    })

    return this.findOne(user, request.id)
  }

  async changeStatus(user: AuthenticatedUser, id: string, dto: ChangeServiceStatusDto) {
    const request = await this.require(user, id)

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.serviceRequest.update({
        where: { id: request.id },
        data: {
          status: dto.status,
          progress: dto.progress ?? request.progress,
          closedAt: dto.status === ServiceStatus.CLOSED ? new Date() : request.closedAt,
        },
        include: { building: true },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Servis arizasi holati o‘zgardi',
          entityType: 'serviceRequest',
          entityId: request.id,
          detail: dto.note ?? `${request.status} dan ${dto.status} ga`,
          meta: { from: request.status, to: dto.status },
        },
        tx,
      )

      return result
    })

    return this.present(updated)
  }

  /** Servis desk ko‘rsatkichlari. */
  async kpi(user: AuthenticatedUser) {
    const where: Prisma.ServiceRequestWhereInput = {
      buildingId: this.scope.buildingFilter(user),
      organizationId: this.scope.organizationFilter(user),
    }

    const grouped = await this.prisma.serviceRequest.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    })

    const total = grouped.reduce((sum, row) => sum + row._count._all, 0)
    const byStatus = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]))

    return {
      total,
      newCount: byStatus[ServiceStatus.NEW] ?? 0,
      inProgress: byStatus[ServiceStatus.IN_PROGRESS] ?? 0,
      completed: byStatus[ServiceStatus.COMPLETED] ?? 0,
      closed: byStatus[ServiceStatus.CLOSED] ?? 0,
      breakdown: grouped.map((row) => ({
        status: row.status,
        count: row._count._all,
        share: total > 0 ? Math.round((row._count._all / total) * 100) : 0,
      })),
      slaBreached: await this.prisma.serviceRequest.count({ where: { ...where, slaBreached: true } }),
    }
  }

  private async require(user: AuthenticatedUser, id: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { OR: [{ id }, { code: id }] },
    })
    if (!request) throw new NotFoundException('Servis arizasi topilmadi')
    this.scope.assertBuilding(user, request.buildingId)
    return request
  }

  private present(
    request: Prisma.ServiceRequestGetPayload<{ include: { building: true } }> | Prisma.ServiceRequestGetPayload<object>,
  ) {
    const building = 'building' in request ? request.building : null
    return {
      id: request.id,
      code: request.code,
      title: request.title,
      category: request.category,
      buildingId: request.buildingId,
      buildingName: building?.name ?? '',
      unitCode: request.unitCode,
      requester: request.requesterName,
      priority: request.priority,
      status: request.status,
      assignee: request.assigneeName,
      createdAt: request.createdAt.toISOString(),
      dueAt: request.dueAt?.toISOString().slice(0, 10) ?? null,
      slaBreached: request.slaBreached,
      description: request.description,
      progress: request.progress,
    }
  }
}
