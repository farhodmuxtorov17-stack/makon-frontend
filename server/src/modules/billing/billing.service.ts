import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  BillingPeriodStatus,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  SchedulePeriodStatus,
} from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { AuditService } from '../audit/audit.service'
import { pageResult } from '../../common/dto/pagination.dto'
import { toNumber, formatMoney } from '../../common/utils/money'
import { agingBucket, daysBetween, parseIsoDate } from '../../common/utils/dates'
import { nextCode } from '../../common/utils/codes'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type {
  CancelInvoiceDto,
  CreateInvoiceDto,
  DebtQueryDto,
  InvoiceQueryDto,
  PaymentQueryDto,
  RegisterPaymentDto,
  RejectPaymentDto,
} from './dto/billing.dto'

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Hisob-fakturalar

  async listInvoices(user: AuthenticatedUser, query: InvoiceQueryDto) {
    const where: Prisma.InvoiceWhereInput = {
      buildingId: this.scope.buildingFilterFor(user, query.buildingId),
      organizationId: this.scope.organizationFilter(user),
      status: query.status,
      agingBucket: query.agingBucket,
      period: query.period ? { code: query.period } : undefined,
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
      this.prisma.invoice.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.invoice.count({ where }),
    ])

    return pageResult(items.map((item) => this.presentInvoice(item)), total, query)
  }

  async findInvoice(user: AuthenticatedUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: { lines: { orderBy: { position: 'asc' } }, payments: true },
    })
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi')
    this.scope.assertBuilding(user, invoice.buildingId)
    this.scope.assertOrganization(user, invoice.organizationId)

    return {
      ...this.presentInvoice(invoice),
      lines: invoice.lines.map((line) => ({
        service: line.service,
        unit: line.unit,
        tariff: toNumber(line.tariff),
        qty: toNumber(line.qty),
        sum: toNumber(line.sum),
      })),
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        code: payment.code,
        amount: toNumber(payment.amount),
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt.toISOString().slice(0, 10),
        reference: payment.reference,
      })),
    }
  }

  async createInvoice(user: AuthenticatedUser, dto: CreateInvoiceDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
      include: { building: true, unit: true, organization: true },
    })
    if (!contract) throw new NotFoundException('Shartnoma topilmadi')
    this.scope.assertBuilding(user, contract.buildingId)

    const lines = dto.lines.map((line, index) => ({
      service: line.service,
      unit: line.unit,
      tariff: new Prisma.Decimal(line.tariff),
      qty: new Prisma.Decimal(line.qty),
      sum: new Prisma.Decimal(Math.round(line.tariff * line.qty)),
      position: index,
    }))
    const total = lines.reduce((sum, line) => sum + toNumber(line.sum), 0)

    const last = await this.prisma.invoice.findFirst({
      where: { code: { startsWith: `INV-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          code: nextCode('INV', new Date().getFullYear(), last?.code),
          organizationId: contract.organizationId,
          contractId: contract.id,
          buildingId: contract.buildingId,
          unitId: contract.unitId,
          periodLabel: dto.periodLabel,
          issuedAt: new Date(),
          dueAt: parseIsoDate(dto.dueAt),
          total: new Prisma.Decimal(total),
          status: InvoiceStatus.DRAFT,
          tenantName: contract.tenantName,
          buildingName: contract.buildingName,
          unitCode: contract.unitCode,
          note: dto.note ?? '',
          lines: { createMany: { data: lines } },
        },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Hisob-faktura yaratildi',
          entityType: 'invoice',
          entityId: created.id,
          detail: `${created.code}, ${dto.periodLabel}, ${formatMoney(total)}`,
        },
        tx,
      )

      return created
    })

    return this.presentInvoice(invoice)
  }

  /** Qoralamani tasdiqlash: hisob-faktura ijarachiga ko‘rinadigan bo‘ladi. */
  async issueInvoice(user: AuthenticatedUser, id: string) {
    const invoice = await this.requireInvoice(user, id)
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException({
        message: 'Faqat qoralama holatidagi hisob-fakturani tasdiqlash mumkin',
        reason: 'INVALID_STATE',
        current: invoice.status,
      })
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.ISSUED, agingBucket: '0-30' },
      })
      await this.audit.record(
        {
          actor: user,
          action: 'Hisob-faktura tasdiqlandi',
          entityType: 'invoice',
          entityId: invoice.id,
          detail: result.code,
          meta: { from: invoice.status, to: InvoiceStatus.ISSUED },
        },
        tx,
      )
      return result
    })

    return this.presentInvoice(updated)
  }

  async cancelInvoice(user: AuthenticatedUser, id: string, dto: CancelInvoiceDto) {
    const invoice = await this.requireInvoice(user, id)
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException({
        message: 'To‘langan hisob-fakturani bekor qilib bo‘lmaydi',
        reason: 'INVALID_STATE',
      })
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.CANCELLED, note: dto.reason },
      })
      await this.audit.record(
        {
          actor: user,
          action: 'Hisob-faktura bekor qilindi',
          entityType: 'invoice',
          entityId: invoice.id,
          detail: dto.reason,
        },
        tx,
      )
      return result
    })

    return this.presentInvoice(updated)
  }

  // -------------------------------------------------------------------------
  // To‘lovlar

  async listPayments(user: AuthenticatedUser, query: PaymentQueryDto) {
    const where: Prisma.PaymentWhereInput = {
      organizationId: this.scope.organizationFilter(user),
      status: query.status,
      invoiceId: query.invoiceId,
      invoice: { buildingId: this.scope.buildingFilter(user) },
      ...(query.search ? { code: { contains: query.search, mode: 'insensitive' } } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { invoice: true },
        orderBy: { paidAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.payment.count({ where }),
    ])

    return pageResult(
      items.map((payment) => ({
        id: payment.id,
        code: payment.code,
        invoiceId: payment.invoiceId,
        invoiceCode: payment.invoice.code,
        tenant: payment.invoice.tenantName,
        buildingName: payment.invoice.buildingName,
        amount: toNumber(payment.amount),
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt.toISOString().slice(0, 10),
        reference: payment.reference,
        confirmedAt: payment.confirmedAt?.toISOString() ?? null,
      })),
      total,
      query,
    )
  }

  /** To‘lov qayd etiladi, tasdiqlashni buxgalter bajaradi. */
  async registerPayment(user: AuthenticatedUser, dto: RegisterPaymentDto) {
    const invoice = await this.requireInvoice(user, dto.invoiceId)

    const last = await this.prisma.payment.findFirst({
      where: { code: { startsWith: `PAY-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          code: nextCode('PAY', new Date().getFullYear(), last?.code),
          invoiceId: invoice.id,
          organizationId: invoice.organizationId,
          amount: new Prisma.Decimal(dto.amount),
          method: dto.method,
          status: PaymentStatus.PENDING,
          paidAt: parseIsoDate(dto.paidAt),
          reference: dto.reference,
        },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'To‘lov qayd etildi',
          entityType: 'payment',
          entityId: created.id,
          detail: `${invoice.code}, ${formatMoney(dto.amount)}`,
        },
        tx,
      )

      return created
    })

    return { id: payment.id, code: payment.code, status: payment.status }
  }

  /**
   * To‘lovni tasdiqlash: hisob-faktura qoldig‘i va holati,
   * to‘lov grafigidagi davr va qarzdorlik birgalikda yangilanadi.
   */
  async confirmPayment(user: AuthenticatedUser, id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: true },
    })
    if (!payment) throw new NotFoundException('To‘lov topilmadi')
    this.scope.assertBuilding(user, payment.invoice.buildingId)

    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException({
        message: 'To‘lov allaqachon ko‘rib chiqilgan',
        reason: 'INVALID_STATE',
        current: payment.status,
      })
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: { status: PaymentStatus.CONFIRMED, confirmedById: user.id, confirmedAt: new Date() },
      })

      const paid = toNumber(payment.invoice.paid) + toNumber(payment.amount)
      const total = toNumber(payment.invoice.total)
      const status =
        paid >= total
          ? InvoiceStatus.PAID
          : paid > 0
            ? InvoiceStatus.PARTIALLY_PAID
            : payment.invoice.status

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paid: new Prisma.Decimal(paid),
          status,
          agingBucket: status === InvoiceStatus.PAID ? null : payment.invoice.agingBucket,
        },
      })

      if (status === InvoiceStatus.PAID) {
        await tx.paymentSchedule.updateMany({
          where: { invoiceId: payment.invoiceId },
          data: { status: SchedulePeriodStatus.PAID },
        })
        await tx.debt.updateMany({
          where: { invoiceId: payment.invoiceId, status: 'OPEN' },
          data: { status: 'SETTLED' },
        })
      }

      await this.audit.record(
        {
          actor: user,
          action: 'To‘lov tasdiqlandi',
          entityType: 'payment',
          entityId: id,
          detail: `${payment.invoice.code}, ${formatMoney(toNumber(payment.amount))}`,
          meta: { invoiceStatus: status },
        },
        tx,
      )
    })

    return { id, status: PaymentStatus.CONFIRMED }
  }

  async rejectPayment(user: AuthenticatedUser, id: string, dto: RejectPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: true },
    })
    if (!payment) throw new NotFoundException('To‘lov topilmadi')
    this.scope.assertBuilding(user, payment.invoice.buildingId)

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: { status: PaymentStatus.REJECTED, rejectReason: dto.reason },
      })
      await this.audit.record(
        {
          actor: user,
          action: 'To‘lov rad etildi',
          entityType: 'payment',
          entityId: id,
          detail: dto.reason,
        },
        tx,
      )
    })

    return { id, status: PaymentStatus.REJECTED }
  }

  // -------------------------------------------------------------------------
  // Qarzdorlik

  async listDebts(user: AuthenticatedUser, query: DebtQueryDto) {
    const where: Prisma.DebtWhereInput = {
      buildingId: this.scope.buildingFilterFor(user, query.buildingId),
      organizationId: this.scope.organizationFilter(user),
      agingBucket: query.agingBucket,
    }

    const [items, total] = await Promise.all([
      this.prisma.debt.findMany({
        where,
        include: { organization: true, building: true, invoice: true },
        orderBy: { daysOverdue: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.debt.count({ where }),
    ])

    return pageResult(
      items.map((debt) => ({
        id: debt.id,
        tenant: debt.organization.name,
        buildingName: debt.building.name,
        invoiceCode: debt.invoice?.code ?? null,
        amount: toNumber(debt.amount),
        daysOverdue: debt.daysOverdue,
        agingBucket: debt.agingBucket,
        status: debt.status,
        note: debt.note,
      })),
      total,
      query,
    )
  }

  /** Qarzdorlik yoshi bo‘yicha taqsimot. */
  async aging(user: AuthenticatedUser) {
    const where: Prisma.DebtWhereInput = {
      buildingId: this.scope.buildingFilter(user),
      organizationId: this.scope.organizationFilter(user),
      status: 'OPEN',
    }

    const grouped = await this.prisma.debt.groupBy({
      by: ['agingBucket'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    })

    const total = grouped.reduce((sum, row) => sum + toNumber(row._sum.amount), 0)
    const labels: Record<string, string> = {
      '0-30': '0 dan 30 kungacha',
      '31-60': '31 dan 60 kungacha',
      '61-90': '61 dan 90 kungacha',
      '90+': '90 kundan ortiq',
    }

    return {
      total,
      buckets: ['0-30', '31-60', '61-90', '90+'].map((bucket) => {
        const row = grouped.find((item) => item.agingBucket === bucket)
        const amount = toNumber(row?._sum.amount)
        return {
          bucket,
          label: labels[bucket] ?? bucket,
          count: row?._count._all ?? 0,
          amount,
          share: total > 0 ? Math.round((amount / total) * 100) : 0,
        }
      }),
    }
  }

  /**
   * Kechikkan hisob-fakturalar bo‘yicha qarzdorlik yozuvlarini yangilaydi.
   * TODO(backend): jadval bo‘yicha avtomatik ishga tushirish rejalashtirilgan.
   */
  async recalculateDebts(user: AuthenticatedUser) {
    const today = new Date()
    const overdue = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
        dueAt: { lt: today },
        buildingId: this.scope.buildingFilter(user),
      },
    })

    let touched = 0
    for (const invoice of overdue) {
      const days = daysBetween(invoice.dueAt, today)
      const bucket = agingBucket(days) ?? '0-30'
      const amount = toNumber(invoice.total) - toNumber(invoice.paid)
      if (amount <= 0) continue

      await this.prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.OVERDUE, agingBucket: bucket },
        })

        const existing = await tx.debt.findFirst({
          where: { invoiceId: invoice.id, status: 'OPEN' },
        })

        if (existing) {
          await tx.debt.update({
            where: { id: existing.id },
            data: { amount: new Prisma.Decimal(amount), daysOverdue: days, agingBucket: bucket },
          })
        } else {
          await tx.debt.create({
            data: {
              organizationId: invoice.organizationId,
              buildingId: invoice.buildingId,
              invoiceId: invoice.id,
              amount: new Prisma.Decimal(amount),
              daysOverdue: days,
              agingBucket: bucket,
              note: `${invoice.code} bo‘yicha kechikish`,
            },
          })
        }
      })
      touched += 1
    }

    await this.audit.record({
      actor: user,
      action: 'Qarzdorlik qayta hisoblandi',
      entityType: 'debt',
      entityId: 'batch',
      detail: `${touched} ta yozuv yangilandi`,
    })

    return { updated: touched }
  }

  // -------------------------------------------------------------------------
  // Hisob-kitob davrlari

  async listPeriods() {
    const periods = await this.prisma.billingPeriod.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
    return periods.map((period) => ({
      id: period.id,
      code: period.code,
      label: period.label,
      status: period.status,
      startsAt: period.startsAt.toISOString().slice(0, 10),
      endsAt: period.endsAt.toISOString().slice(0, 10),
      charged: toNumber(period.charged),
      discounts: toNumber(period.discounts),
      vat: toNumber(period.vat),
      total: toNumber(period.total),
      paidTotal: toNumber(period.paidTotal),
      debtTotal: toNumber(period.debtTotal),
      overdueTotal: toNumber(period.overdueTotal),
    }))
  }

  async closePeriod(user: AuthenticatedUser, id: string) {
    const period = await this.prisma.billingPeriod.findUnique({ where: { id } })
    if (!period) throw new NotFoundException('Hisob-kitob davri topilmadi')
    if (period.status === BillingPeriodStatus.CLOSED) {
      throw new ConflictException({ message: 'Davr allaqachon yopilgan', reason: 'INVALID_STATE' })
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.billingPeriod.update({
        where: { id },
        data: { status: BillingPeriodStatus.CLOSED, closedAt: new Date() },
      })
      await this.audit.record(
        {
          actor: user,
          action: 'Hisob-kitob davri yopildi',
          entityType: 'billingPeriod',
          entityId: id,
          detail: result.label,
        },
        tx,
      )
      return result
    })

    return { id: updated.id, status: updated.status }
  }

  /** Billing sarlavhasidagi yig‘ma ko‘rsatkichlar. */
  async summary(user: AuthenticatedUser, periodCode?: string) {
    const where: Prisma.InvoiceWhereInput = {
      buildingId: this.scope.buildingFilter(user),
      organizationId: this.scope.organizationFilter(user),
      period: periodCode ? { code: periodCode } : undefined,
    }

    const [aggregate, byStatus, period] = await Promise.all([
      this.prisma.invoice.aggregate({ where, _sum: { total: true, paid: true } }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where,
        _sum: { total: true },
        _count: { _all: true },
      }),
      periodCode
        ? this.prisma.billingPeriod.findUnique({ where: { code: periodCode } })
        : this.prisma.billingPeriod.findFirst({ orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
    ])

    const total = toNumber(aggregate._sum.total)
    const paid = toNumber(aggregate._sum.paid)
    const overdue = toNumber(
      byStatus.find((row) => row.status === InvoiceStatus.OVERDUE)?._sum.total,
    )

    const totalCount = byStatus.reduce((sum, row) => sum + row._count._all, 0)

    return {
      period: period?.label ?? null,
      periodCode: period?.code ?? null,
      charged: total,
      discounts: toNumber(period?.discounts),
      vat: toNumber(period?.vat),
      total,
      paidTotal: paid,
      debtTotal: Math.max(0, total - paid),
      overdueTotal: overdue,
      breakdown: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
        amount: toNumber(row._sum.total),
        share: totalCount > 0 ? Math.round((row._count._all / totalCount) * 100) : 0,
      })),
    }
  }

  // -------------------------------------------------------------------------

  private async requireInvoice(user: AuthenticatedUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { OR: [{ id }, { code: id }] } })
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi')
    this.scope.assertBuilding(user, invoice.buildingId)
    this.scope.assertOrganization(user, invoice.organizationId)
    return invoice
  }

  private presentInvoice(invoice: Prisma.InvoiceGetPayload<object>) {
    return {
      id: invoice.id,
      code: invoice.code,
      tenant: invoice.tenantName,
      organizationId: invoice.organizationId,
      buildingId: invoice.buildingId,
      buildingName: invoice.buildingName,
      unitCode: invoice.unitCode,
      period: invoice.periodLabel,
      issuedAt: invoice.issuedAt.toISOString().slice(0, 10),
      dueAt: invoice.dueAt.toISOString().slice(0, 10),
      total: toNumber(invoice.total),
      paid: toNumber(invoice.paid),
      status: invoice.status,
      agingBucket: invoice.agingBucket,
      note: invoice.note,
    }
  }
}
