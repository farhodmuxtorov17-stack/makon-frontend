import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  ApplicationStatus,
  ContractStatus,
  DidoxState,
  DocumentKind,
  InvoiceStatus,
  LeaseStatus,
  ListingStatus,
  Prisma,
  ScheduleKind,
  SchedulePeriodStatus,
  UnitStatus,
} from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { AuditService } from '../audit/audit.service'
import { LeaseAction, LeaseStateMachine } from './lease-state-machine'
import { ContractComposer, type ContractParty } from './contract.composer'
import {
  buildSchedule,
  scheduleTotals,
  serviceTotalOf,
  type OfferTerms,
  type SchedulePlanRow,
} from './schedule.builder'
import { DIDOX_CLIENT, type DidoxClient } from '../didox/didox-client.interface'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { pageResult } from '../../common/dto/pagination.dto'
import { formatDmy, monthLabel, parseIsoDate } from '../../common/utils/dates'
import { formatMoney, toNumber } from '../../common/utils/money'
import { nextCode } from '../../common/utils/codes'
import type {
  LeaseCaseQueryDto,
  MarkContactedDto,
  OfferTermsDto,
  RejectDto,
  ReturnForReworkDto,
  SubmitLeaseCaseDto,
  UploadSignedDocumentDto,
} from './dto/lease.dto'

const CASE_INCLUDE = {
  organization: true,
  unit: true,
  building: true,
  commercialOffer: true,
  schedule: { orderBy: { position: 'asc' } },
  contract: true,
  didoxTickets: { orderBy: { createdAt: 'desc' } },
  documents: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.LeaseCaseInclude

type LeaseCaseFull = Prisma.LeaseCaseGetPayload<{ include: typeof CASE_INCLUDE }>

/** Didox holatining interfeysdagi nomi. */
const DIDOX_LABELS: Record<DidoxState, string> = {
  YUBORILGAN: 'Yuborilgan',
  KORIB_CHIQILMOQDA: 'Ko‘rib chiqilmoqda',
  IMZOLANGAN: 'Imzolangan',
  RAD_ETILGAN: 'Rad etilgan',
}

@Injectable()
export class LeaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
    private readonly machine: LeaseStateMachine,
    private readonly composer: ContractComposer,
    @Inject(DIDOX_CLIENT) private readonly didox: DidoxClient,
  ) {}

  // -------------------------------------------------------------------------
  // O‘qish

  async list(user: AuthenticatedUser, query: LeaseCaseQueryDto) {
    const where: Prisma.LeaseCaseWhereInput = {
      buildingId: this.scope.buildingFilterFor(user, query.buildingId),
      organizationId: this.scope.organizationFilter(user),
      status: query.status,
      unitId: query.unitId,
      ...(query.pending === 'true'
        ? { status: { notIn: [LeaseStatus.FAOL, LeaseStatus.RAD_ETILDI] } }
        : {}),
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
        include: CASE_INCLUDE,
        orderBy: { submittedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.leaseCase.count({ where }),
    ])

    return pageResult(
      items.map((item) => this.present(item, user)),
      total,
      query,
    )
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    this.scope.assertOrganization(user, item.organizationId)
    return this.present(item, user)
  }

  async trail(user: AuthenticatedUser, id: string) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    this.scope.assertOrganization(user, item.organizationId)
    return this.audit.trail('leaseCase', item.id)
  }

  // -------------------------------------------------------------------------
  // 1-bosqich: ijarachi ariza yuboradi

  async submit(user: AuthenticatedUser, dto: SubmitLeaseCaseDto) {
    this.machine.assertTransition(LeaseAction.SUBMIT, LeaseStatus.YANGI, user)

    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      include: { building: true },
    })
    if (!unit) throw new NotFoundException('Unit topilmadi')
    if (unit.status !== UnitStatus.VACANT) {
      throw new ConflictException({
        message: 'Bu unit hozir bo‘sh emas, ariza qabul qilinmaydi',
        reason: 'UNIT_NOT_VACANT',
        status: unit.status,
      })
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
    })
    if (!organization) throw new NotFoundException('Tashkilot topilmadi')

    const last = await this.prisma.leaseCase.findFirst({
      where: { code: { startsWith: `ARZ-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    const created = await this.prisma.$transaction(async (tx) => {
      const leaseCase = await tx.leaseCase.create({
        data: {
          code: nextCode('ARZ', new Date().getFullYear(), last?.code),
          status: LeaseStatus.YANGI,
          applicationStatus: ApplicationStatus.SUBMITTED,
          organizationId: organization.id,
          unitId: unit.id,
          buildingId: unit.buildingId,
          requestType: dto.requestType,
          offerPrice: new Prisma.Decimal(dto.offerPrice),
          startDate: parseIsoDate(dto.startDate),
          term: dto.term,
          note: dto.note ?? '',
          contactPerson: organization.director ?? user.fullName,
          contactPhone: organization.phone ?? user.phone,
        },
      })

      await tx.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.APPLICATION_IN_REVIEW },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Ariza yuborildi',
          entityType: 'leaseCase',
          entityId: leaseCase.id,
          detail:
            `${unit.building.name}, Unit ${unit.code}, ${dto.term} oy, ` +
            formatMoney(dto.offerPrice),
          meta: { to: LeaseStatus.YANGI },
        },
        tx,
      )

      return leaseCase
    })

    return this.findOne(user, created.id)
  }

  // -------------------------------------------------------------------------
  // 2-bosqich: operator bog‘lanadi

  async markContacted(user: AuthenticatedUser, id: string, dto: MarkContactedDto) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    this.machine.assertTransition(LeaseAction.MARK_CONTACTED, item.status, user)

    if (item.contactedAt) {
      throw new ConflictException({
        message: 'Bog‘lanish allaqachon qayd etilgan',
        reason: 'ALREADY_CONTACTED',
      })
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.leaseCase.update({
        where: { id: item.id },
        data: {
          contactedAt: new Date(),
          contactedById: user.id,
          applicationStatus: ApplicationStatus.BUILDING_REVIEW,
        },
      })
      await this.audit.record(
        {
          actor: user,
          action: 'Bog‘lanildi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail:
            dto.note ??
            `${item.organization.director ?? item.organization.name} bilan ` +
              `${item.contactPhone ?? item.organization.phone ?? ''} raqami orqali gaplashildi`,
        },
        tx,
      )
    })

    return this.findOne(user, id)
  }

  // -------------------------------------------------------------------------
  // 3-bosqich: kelishilgan shartlar va to‘lov grafigi

  /** Shartlarni saqlaydi, grafik darhol qayta hisoblanadi. */
  async saveOffer(user: AuthenticatedUser, id: string, dto: OfferTermsDto) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    this.machine.assertTransition(LeaseAction.SAVE_OFFER, item.status, user)

    await this.persistOffer(item, dto)
    await this.audit.record({
      actor: user,
      action: 'Kelishilgan shartlar saqlandi',
      entityType: 'leaseCase',
      entityId: item.id,
      detail:
        `Oylik ijara ${formatMoney(dto.monthlyRent)}, depozit ${formatMoney(dto.deposit)}, ` +
        `servis ${formatMoney(dto.servicePerSqm)} / m²`,
    })

    return this.findOne(user, id)
  }

  /** Bino rahbari operatsion tasdiqni qo‘yadi. */
  async approveOperation(user: AuthenticatedUser, id: string, dto: OfferTermsDto) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    const { next } = this.machine.assertTransition(LeaseAction.APPROVE_OPERATION, item.status, user)

    const rows = await this.persistOffer(item, dto, { approvedByOpsId: user.id })
    const totals = scheduleTotals(rows)

    await this.prisma.$transaction(async (tx) => {
      await tx.leaseCase.update({
        where: { id: item.id },
        data: { status: next, applicationStatus: ApplicationStatus.FINANCE_REVIEW },
      })
      await this.audit.record(
        {
          actor: user,
          action: 'Operatsiya tasdiqladi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail:
            `Oylik ijara ${formatMoney(dto.monthlyRent)}, depozit ${formatMoney(dto.deposit)}, ` +
            `${totals.periods} ta to‘lov davri`,
          meta: { from: item.status, to: next },
        },
        tx,
      )
    })

    return this.findOne(user, id)
  }

  // -------------------------------------------------------------------------
  // 4-bosqich: buxgalter moliyani tekshiradi

  async approveFinance(user: AuthenticatedUser, id: string, dto: OfferTermsDto) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    const { next } = this.machine.assertTransition(LeaseAction.APPROVE_FINANCE, item.status, user)

    const before = item.commercialOffer
    const changed =
      !before ||
      toNumber(before.monthlyRent) !== dto.monthlyRent ||
      toNumber(before.deposit) !== dto.deposit ||
      toNumber(before.servicePerSqm) !== dto.servicePerSqm ||
      before.periodicity !== dto.periodicity

    if (changed && !dto.adjustmentReason) {
      throw new BadRequestException('Shartlar o‘zgartirilganda sabab kiritilishi kerak')
    }

    const rows = await this.persistOffer(item, dto, { approvedByFinanceId: user.id })
    const totals = scheduleTotals(rows)

    await this.prisma.$transaction(async (tx) => {
      await tx.leaseCase.update({
        where: { id: item.id },
        data: { status: next, applicationStatus: ApplicationStatus.APPROVED },
      })
      await this.audit.record(
        {
          actor: user,
          action: 'Moliya tasdiqladi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail: changed
            ? `Shartlar tuzatildi: ${dto.adjustmentReason}. Shartnoma summasi ${formatMoney(totals.total)}`
            : `Shartlar o‘zgarishsiz tasdiqlandi. Shartnoma summasi ${formatMoney(totals.total)}`,
          meta: { from: item.status, to: next, changed },
        },
        tx,
      )
    })

    return this.findOne(user, id)
  }

  // -------------------------------------------------------------------------
  // 5-bosqich: shartnoma qoralamasi

  async composeContract(user: AuthenticatedUser, id: string) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    const { next } = this.machine.assertTransition(LeaseAction.COMPOSE_CONTRACT, item.status, user)

    if (!item.commercialOffer) {
      throw new ConflictException({
        message: 'Kelishilgan shartlar yo‘q, qoralama tuzilmaydi',
        reason: 'OFFER_MISSING',
      })
    }

    const landlord = await this.landlordParty()
    const last = await this.prisma.contract.findFirst({
      where: { code: { startsWith: `MKON-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    const offer = this.toOfferTerms(item)
    const rows = this.planRows(item)
    const composed = this.composer.compose({
      code: nextCode('MKON', new Date().getFullYear(), last?.code),
      offer,
      schedule: rows,
      startDate: item.startDate,
      term: item.term,
      area: toNumber(item.unit.area),
      unitCode: item.unit.code,
      floor: item.unit.floor,
      usage: item.unit.usage,
      buildingName: item.building.name,
      buildingAddress: `${item.building.city}, ${item.building.district}, ${item.building.street}`,
      landlord,
      tenant: this.tenantParty(item),
    })

    await this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          code: composed.body.code,
          type: item.requestType === 'Sotib olish' ? 'Sotuv' : 'Ijara',
          status: ContractStatus.DRAFT,
          leaseCaseId: item.id,
          organizationId: item.organizationId,
          buildingId: item.buildingId,
          unitId: item.unitId,
          tenantName: item.organization.name,
          buildingName: item.building.name,
          unitCode: `Unit ${item.unit.code}`,
          startsAt: composed.startsAt,
          endsAt: composed.endsAt,
          amount: new Prisma.Decimal(composed.amount),
          paymentTerm: `${offer.periodicity} oldindan to‘lov`,
          body: composed.body as unknown as Prisma.InputJsonValue,
          composedAt: new Date(),
        },
      })

      await tx.contractTimelineEntry.createMany({
        data: [
          {
            contractId: contract.id,
            label: 'Yaratildi',
            occurredAt: new Date(),
            actor: user.fullName,
            done: true,
            position: 0,
          },
          { contractId: contract.id, label: 'Kelishildi', actor: '-', done: false, position: 1 },
          { contractId: contract.id, label: 'Imzolandi', actor: '-', done: false, position: 2 },
          { contractId: contract.id, label: 'Faollashdi', actor: '-', done: false, position: 3 },
        ],
      })

      await tx.paymentSchedule.updateMany({
        where: { leaseCaseId: item.id },
        data: { contractId: contract.id },
      })

      await tx.document.create({
        data: {
          kind: DocumentKind.CONTRACT_DRAFT,
          fileName: `${contract.code}.docx`,
          storageKey: `contracts/${contract.code}/draft.docx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          extension: 'docx',
          size: Buffer.byteLength(this.composer.render(composed.body), 'utf8'),
          organizationId: item.organizationId,
          leaseCaseId: item.id,
          contractId: contract.id,
          uploadedById: user.id,
          uploadedByName: user.fullName,
        },
      })

      await tx.leaseCase.update({
        where: { id: item.id },
        data: { status: next, applicationStatus: ApplicationStatus.DOCUMENTS },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Shartnoma qoralamasi tuzildi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail: `${contract.code}: ${item.term} oy, ${formatMoney(composed.amount)}`,
          meta: { from: item.status, to: next, contractCode: contract.code },
        },
        tx,
      )
    })

    return this.findOne(user, id)
  }

  /** Qoralamaning matnli ko‘rinishi, hujjatni ko‘rish oynasi uchun. */
  async contractPreview(user: AuthenticatedUser, id: string) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    this.scope.assertOrganization(user, item.organizationId)
    if (!item.contract?.body) throw new NotFoundException('Shartnoma qoralamasi hali tuzilmagan')

    const body = item.contract.body as unknown as Parameters<ContractComposer['render']>[0]
    return {
      code: item.contract.code,
      fileName: `${item.contract.code}.docx`,
      body,
      text: this.composer.render(body),
    }
  }

  // -------------------------------------------------------------------------
  // 6-bosqich: Didox orqali yuborish

  async sendToDidox(user: AuthenticatedUser, id: string) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    const { next } = this.machine.assertTransition(LeaseAction.SEND_TO_DIDOX, item.status, user)

    if (!item.contract?.body) {
      throw new ConflictException({
        message: 'Shartnoma qoralamasi yo‘q',
        reason: 'CONTRACT_MISSING',
      })
    }

    const body = item.contract.body as unknown as Parameters<ContractComposer['render']>[0]
    const content = Buffer.from(this.composer.render(body), 'utf8')

    const sent = await this.didox.send({
      contractCode: item.contract.code,
      recipientName: item.organization.name,
      recipientTin: item.organization.tin ?? '',
      content,
      fileName: `${item.contract.code}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.didoxTicket.create({
        data: {
          leaseCaseId: item.id,
          docNumber: sent.docNumber,
          externalId: sent.externalId,
          recipientName: item.organization.name,
          recipientTin: item.organization.tin ?? '',
          state: sent.state,
          sentAt: sent.sentAt,
          sentById: user.id,
          sentByName: user.fullName,
          history: [
            { state: DIDOX_LABELS[sent.state], at: sent.sentAt.toISOString(), note: sent.note },
          ] as unknown as Prisma.InputJsonValue,
        },
      })

      await tx.contract.update({
        where: { id: item.contract!.id },
        data: { status: ContractStatus.REVIEW },
      })

      await tx.leaseCase.update({ where: { id: item.id }, data: { status: next } })

      await this.audit.record(
        {
          actor: user,
          action: 'Didox orqali yuborildi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail: `${item.contract!.code}, Didox hujjat raqami ${sent.docNumber}`,
          meta: { from: item.status, to: next, docNumber: sent.docNumber },
        },
        tx,
      )
    })

    return this.findOne(user, id)
  }

  // -------------------------------------------------------------------------
  // 7-bosqich: holatni tekshirish

  async checkDidox(user: AuthenticatedUser, id: string) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    this.machine.assertTransition(LeaseAction.CHECK_DIDOX, item.status, user)

    const ticket = item.didoxTickets[0]
    if (!ticket) {
      throw new ConflictException({
        message: 'Didox chiptasi topilmadi',
        reason: 'DIDOX_TICKET_MISSING',
      })
    }

    const status = await this.didox.getStatus(ticket.docNumber)
    const history = Array.isArray(ticket.history) ? [...(ticket.history as unknown[])] : []
    if (status.state !== ticket.state) {
      history.push({
        state: DIDOX_LABELS[status.state],
        at: status.checkedAt.toISOString(),
        note: status.note,
      })
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.didoxTicket.update({
        where: { id: ticket.id },
        data: {
          state: status.state,
          lastCheckedAt: status.checkedAt,
          signedFileUrl: status.signedFileUrl,
          history: history as unknown as Prisma.InputJsonValue,
        },
      })

      if (status.state === DidoxState.IMZOLANGAN) {
        await tx.leaseCase.update({
          where: { id: item.id },
          data: { status: LeaseStatus.DIDOX_IMZOLANDI },
        })
        await tx.contract.update({
          where: { id: item.contract!.id },
          data: { status: ContractStatus.SIGNED, signedAt: status.checkedAt },
        })
      }

      if (status.state === DidoxState.RAD_ETILGAN) {
        await tx.leaseCase.update({
          where: { id: item.id },
          data: { status: LeaseStatus.RAD_ETILDI, rejectReason: status.note },
        })
      }

      await this.audit.record(
        {
          actor: user,
          action: 'Didox holati tekshirildi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail: `${ticket.docNumber}, yangi holat: ${DIDOX_LABELS[status.state]}`,
          meta: { docNumber: ticket.docNumber, state: status.state },
        },
        tx,
      )
    })

    return this.findOne(user, id)
  }

  // -------------------------------------------------------------------------
  // 8-bosqich: imzolangan faylni yuklash

  async uploadSigned(user: AuthenticatedUser, id: string, dto: UploadSignedDocumentDto) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    this.machine.assertTransition(LeaseAction.UPLOAD_SIGNED, item.status, user)

    await this.prisma.$transaction(async (tx) => {
      await tx.document.deleteMany({
        where: { leaseCaseId: item.id, kind: DocumentKind.SIGNED_CONTRACT },
      })

      await tx.document.create({
        data: {
          kind: DocumentKind.SIGNED_CONTRACT,
          fileName: dto.fileName,
          storageKey: dto.storageKey ?? `contracts/${item.contract?.code ?? item.code}/${dto.fileName}`,
          mimeType: dto.mimeType,
          extension: dto.extension,
          size: dto.size,
          hash: dto.hash.toLowerCase(),
          organizationId: item.organizationId,
          leaseCaseId: item.id,
          contractId: item.contract?.id,
          uploadedById: user.id,
          uploadedByName: user.fullName,
        },
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Imzolangan hujjat yuklandi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail: `${dto.fileName}, SHA-256: ${dto.hash.slice(0, 16)}`,
          meta: { hash: dto.hash, size: dto.size },
        },
        tx,
      )
    })

    return this.findOne(user, id)
  }

  async removeSigned(user: AuthenticatedUser, id: string) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    if (item.status === LeaseStatus.FAOL) {
      throw new ConflictException({
        message: 'Faol shartnomaning hujjatini olib tashlab bo‘lmaydi',
        reason: 'INVALID_STATE',
      })
    }

    const signed = item.documents.find((doc) => doc.kind === DocumentKind.SIGNED_CONTRACT)
    if (!signed) throw new NotFoundException('Yuklangan hujjat topilmadi')

    await this.prisma.$transaction(async (tx) => {
      await tx.document.delete({ where: { id: signed.id } })
      await this.audit.record(
        {
          actor: user,
          action: 'Yuklangan hujjat olib tashlandi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail: signed.fileName,
        },
        tx,
      )
    })

    return this.findOne(user, id)
  }

  // -------------------------------------------------------------------------
  // Faollashtirish: barcha oqibatlar bitta tranzaksiyada

  async activate(user: AuthenticatedUser, id: string) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    const { next } = this.machine.assertTransition(LeaseAction.ACTIVATE, item.status, user)

    if (!item.contract) {
      throw new ConflictException({ message: 'Shartnoma topilmadi', reason: 'CONTRACT_MISSING' })
    }

    const signed = item.documents.find((doc) => doc.kind === DocumentKind.SIGNED_CONTRACT)
    if (!signed) {
      throw new ConflictException({
        message: 'Imzolangan hujjat yuklanmagan, faollashtirish mumkin emas',
        reason: 'SIGNED_DOCUMENT_MISSING',
      })
    }

    const first = item.schedule.find((row) => row.kind === ScheduleKind.RENT)
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { code: { startsWith: `INV-${new Date().getFullYear()}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    const invoiceCode = nextCode('INV', new Date().getFullYear(), lastInvoice?.code)

    /**
     * Faollashtirish bitta tranzaksiya: unit bandligi, katalog ko‘rinishi,
     * bino statistikasi, shartnoma va birinchi hisob-faktura birgalikda
     * yoziladi. Bir qismi bajarilmasa, hech biri qo‘llanmaydi.
     */
    const changes = await this.prisma.$transaction(async (tx) => {
      const activatedAt = new Date()
      const area = toNumber(item.unit.area)

      await tx.unit.update({
        where: { id: item.unitId },
        data: {
          status: UnitStatus.RENTED,
          listing: ListingStatus.ARCHIVED,
          tenantName: item.organization.name,
          contractCode: item.contract!.code,
        },
      })

      const building = await tx.building.findUniqueOrThrow({ where: { id: item.buildingId } })
      const vacantUnits = Math.max(0, building.vacantUnits - 1)
      const vacantArea = Math.max(0, toNumber(building.vacantArea) - area)
      const gla = toNumber(building.gla)
      const occupancy = gla > 0 ? Math.round(((gla - vacantArea) / gla) * 100) : building.occupancy

      await tx.building.update({
        where: { id: building.id },
        data: {
          vacantUnits,
          occupiedUnits: building.occupiedUnits + 1,
          vacantArea: new Prisma.Decimal(vacantArea),
          occupancy,
        },
      })

      await tx.contract.update({
        where: { id: item.contract!.id },
        data: { status: ContractStatus.ACTIVE, activatedAt },
      })

      await tx.contractTimelineEntry.updateMany({
        where: { contractId: item.contract!.id, label: { in: ['Kelishildi', 'Imzolandi'] } },
        data: { done: true, occurredAt: activatedAt, actor: user.fullName },
      })

      await tx.contractTimelineEntry.updateMany({
        where: { contractId: item.contract!.id, label: 'Faollashdi' },
        data: { done: true, occurredAt: activatedAt, actor: 'Tizim' },
      })

      let invoiceLabel = ''
      if (first) {
        const invoice = await tx.invoice.create({
          data: {
            code: invoiceCode,
            organizationId: item.organizationId,
            contractId: item.contract!.id,
            buildingId: item.buildingId,
            unitId: item.unitId,
            periodLabel: monthLabel(first.dueAt),
            issuedAt: activatedAt,
            dueAt: first.dueAt,
            total: first.total,
            paid: new Prisma.Decimal(0),
            status: InvoiceStatus.ISSUED,
            agingBucket: '0-30',
            tenantName: item.organization.name,
            buildingName: item.building.name,
            unitCode: `Unit ${item.unit.code}`,
          },
        })

        await tx.paymentSchedule.update({
          where: { id: first.id },
          data: { status: SchedulePeriodStatus.ISSUED, invoiceId: invoice.id },
        })

        invoiceLabel =
          `${first.label}, ${formatMoney(toNumber(first.total))}, ` +
          `to‘lov muddati ${formatDmy(first.dueAt)}`
      }

      await tx.leaseCase.update({
        where: { id: item.id },
        data: {
          status: next,
          applicationStatus: ApplicationStatus.COMPLETED,
          activatedAt,
        },
      })

      await tx.notification.createMany({
        data: (
          await tx.user.findMany({
            where: { organizationId: item.organizationId, isActive: true },
            select: { id: true },
          })
        ).map((tenantUser) => ({
          userId: tenantUser.id,
          title: 'Shartnoma faollashdi',
          body:
            `${item.contract!.code} shartnomasi faollashtirildi. Unit, to‘lov grafigi va ` +
            `${invoiceCode} hisob-fakturasi kabinetingizga qo‘shildi.`,
          category: 'Hujjatlar',
          icon: 'contract',
          link: `/cabinet/documents`,
        })),
      })

      await this.audit.record(
        {
          actor: user,
          action: 'Shartnoma faollashtirildi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail:
            `Unit band qilindi, ${invoiceCode} hisob-fakturasi va to‘lov grafigi ishga tushdi`,
          meta: { from: item.status, to: next, invoiceCode, contractCode: item.contract!.code },
        },
        tx,
      )

      return [
        {
          icon: 'building',
          label: 'Unit holati «Ijarada» ga o‘tdi',
          detail: `${item.building.name}, Unit ${item.unit.code}, ${item.organization.name} nomiga rasmiylashtirildi`,
        },
        {
          icon: 'eye',
          label: 'Unit ommaviy katalogdan olib tashlandi',
          detail: 'Bo‘sh joylar katalogida va xaritada endi ko‘rinmaydi',
        },
        {
          icon: 'chart',
          label: 'Bino statistikasi qayta hisoblandi',
          detail: `Bandlik ${occupancy}%, bo‘sh maydon ${Math.round(vacantArea)} m², bo‘sh unitlar ${vacantUnits} ta`,
        },
        {
          icon: 'contract',
          label: `Shartnoma ${item.contract!.code} faollashtirildi`,
          detail: 'Ijarachi kabinetiga shartnoma, unit va to‘lov grafigi qo‘shildi',
        },
        {
          icon: 'wallet',
          label: `Birinchi hisob-faktura ${invoiceCode} yaratildi`,
          detail: invoiceLabel,
        },
      ]
    })

    const fresh = await this.findOne(user, id)
    return { ...fresh, activation: { at: new Date().toISOString(), invoiceCode, changes } }
  }

  // -------------------------------------------------------------------------
  // Rad etish va qayta ishlashga qaytarish

  async reject(user: AuthenticatedUser, id: string, dto: RejectDto) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    const { next } = this.machine.assertTransition(LeaseAction.REJECT, item.status, user)

    await this.prisma.$transaction(async (tx) => {
      await tx.leaseCase.update({
        where: { id: item.id },
        data: {
          status: next,
          applicationStatus: ApplicationStatus.REJECTED,
          rejectReason: dto.reason,
        },
      })

      if (item.unit.status === UnitStatus.APPLICATION_IN_REVIEW) {
        await tx.unit.update({
          where: { id: item.unitId },
          data: { status: UnitStatus.VACANT, listing: ListingStatus.PUBLISHED },
        })
      }

      await this.audit.record(
        {
          actor: user,
          action: 'Ariza rad etildi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail: dto.reason,
          meta: { from: item.status, to: next },
        },
        tx,
      )
    })

    return this.findOne(user, id)
  }

  async returnForRework(user: AuthenticatedUser, id: string, dto: ReturnForReworkDto) {
    const item = await this.load(id)
    this.scope.assertBuilding(user, item.buildingId)
    const { next } = this.machine.assertTransition(
      LeaseAction.RETURN_FOR_REWORK,
      item.status,
      user,
    )

    await this.prisma.$transaction(async (tx) => {
      await tx.leaseCase.update({ where: { id: item.id }, data: { status: next } })
      await this.audit.record(
        {
          actor: user,
          action: 'Qayta ishlashga yuborildi',
          entityType: 'leaseCase',
          entityId: item.id,
          detail: dto.reason,
          meta: { from: item.status, to: next },
        },
        tx,
      )
    })

    return this.findOne(user, id)
  }

  // -------------------------------------------------------------------------
  // Yordamchilar

  private async load(id: string): Promise<LeaseCaseFull> {
    const item = await this.prisma.leaseCase.findUnique({ where: { id }, include: CASE_INCLUDE })
    if (!item) throw new NotFoundException('Ariza topilmadi')
    return item
  }

  private toOfferTerms(item: LeaseCaseFull): OfferTerms {
    const offer = item.commercialOffer
    return {
      monthlyRent: toNumber(offer?.monthlyRent),
      deposit: toNumber(offer?.deposit),
      servicePerSqm: toNumber(offer?.servicePerSqm),
      periodicity: offer?.periodicity ?? 'Oylik',
    }
  }

  private planRows(item: LeaseCaseFull): SchedulePlanRow[] {
    return item.schedule.map((row) => ({
      kind: row.kind,
      label: row.label,
      dueAt: row.dueAt,
      months: row.months,
      rent: toNumber(row.rent),
      service: toNumber(row.service),
      total: toNumber(row.total),
      position: row.position,
    }))
  }

  /** Shartlarni yozadi va to‘lov grafigini butunlay qayta quradi. */
  private async persistOffer(
    item: LeaseCaseFull,
    dto: OfferTermsDto,
    approvals: { approvedByOpsId?: string; approvedByFinanceId?: string } = {},
  ): Promise<SchedulePlanRow[]> {
    const area = toNumber(item.unit.area)
    const rows = buildSchedule(
      {
        monthlyRent: dto.monthlyRent,
        deposit: dto.deposit,
        servicePerSqm: dto.servicePerSqm,
        periodicity: dto.periodicity,
      },
      { startDate: item.startDate, term: item.term },
      area,
    )

    await this.prisma.$transaction(async (tx) => {
      await tx.commercialOffer.upsert({
        where: { leaseCaseId: item.id },
        create: {
          leaseCaseId: item.id,
          monthlyRent: new Prisma.Decimal(dto.monthlyRent),
          deposit: new Prisma.Decimal(dto.deposit),
          servicePerSqm: new Prisma.Decimal(dto.servicePerSqm),
          periodicity: dto.periodicity,
          adjustmentReason: dto.adjustmentReason ?? '',
          approvedByOpsId: approvals.approvedByOpsId,
          approvedByOpsAt: approvals.approvedByOpsId ? new Date() : undefined,
          approvedByFinanceId: approvals.approvedByFinanceId,
          approvedByFinanceAt: approvals.approvedByFinanceId ? new Date() : undefined,
        },
        update: {
          monthlyRent: new Prisma.Decimal(dto.monthlyRent),
          deposit: new Prisma.Decimal(dto.deposit),
          servicePerSqm: new Prisma.Decimal(dto.servicePerSqm),
          periodicity: dto.periodicity,
          adjustmentReason: dto.adjustmentReason ?? '',
          approvedByOpsId: approvals.approvedByOpsId,
          approvedByOpsAt: approvals.approvedByOpsId ? new Date() : undefined,
          approvedByFinanceId: approvals.approvedByFinanceId,
          approvedByFinanceAt: approvals.approvedByFinanceId ? new Date() : undefined,
        },
      })

      await tx.paymentSchedule.deleteMany({
        where: { leaseCaseId: item.id, status: SchedulePeriodStatus.PLANNED },
      })

      await tx.paymentSchedule.createMany({
        data: rows.map((row) => ({
          leaseCaseId: item.id,
          contractId: item.contract?.id ?? null,
          kind: row.kind,
          label: row.label,
          dueAt: row.dueAt,
          months: row.months,
          rent: new Prisma.Decimal(row.rent),
          service: new Prisma.Decimal(row.service),
          total: new Prisma.Decimal(row.total),
          position: row.position,
        })),
      })
    })

    return rows
  }

  private tenantParty(item: LeaseCaseFull): ContractParty {
    return {
      role: 'Ijarachi',
      name: item.organization.name,
      tin: item.organization.tin ?? '',
      director: item.organization.director ?? item.organization.name,
      phone: item.organization.phone ?? '',
      email: item.organization.email ?? '',
      address: item.organization.address ?? '',
    }
  }

  private async landlordParty(): Promise<ContractParty> {
    const organization = await this.prisma.organization.findFirst({ where: { isLandlord: true } })
    if (!organization) {
      throw new ConflictException({
        message: 'Ijaraga beruvchi tashkilot sozlanmagan',
        reason: 'LANDLORD_MISSING',
      })
    }
    return {
      role: 'Ijaraga beruvchi',
      name: organization.name,
      tin: organization.tin ?? '',
      director: organization.director ?? '',
      phone: organization.phone ?? '',
      email: organization.email ?? '',
      address: organization.address ?? '',
    }
  }

  /** Javob shakli: frontenddagi ijara ishi modeliga mos. */
  private present(item: LeaseCaseFull, user: AuthenticatedUser) {
    const offer = item.commercialOffer
    const area = toNumber(item.unit.area)
    const rows = this.planRows(item)
    const ticket = item.didoxTickets[0]
    const signed = item.documents.find((doc) => doc.kind === DocumentKind.SIGNED_CONTRACT)

    return {
      id: item.id,
      code: item.code,
      status: item.status,
      applicationStatus: item.applicationStatus,
      unitId: item.unitId,
      unitCode: item.unit.code,
      area,
      floor: item.unit.floor,
      usage: item.unit.usage,
      buildingId: item.buildingId,
      buildingName: item.building.name,
      buildingAddress: `${item.building.city}, ${item.building.district}, ${item.building.street}`,
      org: {
        id: item.organization.id,
        name: item.organization.name,
        tin: item.organization.tin,
        director: item.organization.director,
        phone: item.organization.phone,
        email: item.organization.email,
        address: item.organization.address,
      },
      request: {
        type: item.requestType,
        offerPrice: toNumber(item.offerPrice),
        startDate: item.startDate.toISOString().slice(0, 10),
        term: item.term,
        note: item.note,
        submittedAt: item.submittedAt.toISOString(),
      },
      offer: offer
        ? {
            monthlyRent: toNumber(offer.monthlyRent),
            deposit: toNumber(offer.deposit),
            servicePerSqm: toNumber(offer.servicePerSqm),
            serviceTotal: serviceTotalOf(
              {
                monthlyRent: toNumber(offer.monthlyRent),
                deposit: toNumber(offer.deposit),
                servicePerSqm: toNumber(offer.servicePerSqm),
                periodicity: offer.periodicity,
              },
              area,
            ),
            periodicity: offer.periodicity,
            adjustmentReason: offer.adjustmentReason,
          }
        : null,
      schedule: item.schedule.map((row) => ({
        id: row.id,
        kind: row.kind,
        label: row.label,
        dueAt: row.dueAt.toISOString().slice(0, 10),
        months: row.months,
        rent: toNumber(row.rent),
        service: toNumber(row.service),
        total: toNumber(row.total),
        status: row.status,
      })),
      totals: scheduleTotals(rows),
      contract: item.contract
        ? {
            id: item.contract.id,
            code: item.contract.code,
            status: item.contract.status,
            startsAt: item.contract.startsAt.toISOString().slice(0, 10),
            endsAt: item.contract.endsAt?.toISOString().slice(0, 10) ?? null,
            amount: toNumber(item.contract.amount),
            body: item.contract.body,
          }
        : null,
      didox: ticket
        ? {
            docNumber: ticket.docNumber,
            sentAt: ticket.sentAt.toISOString(),
            sentBy: ticket.sentByName,
            recipient: ticket.recipientName,
            recipientTin: ticket.recipientTin,
            state: ticket.state,
            stateLabel: DIDOX_LABELS[ticket.state],
            lastCheckedAt: ticket.lastCheckedAt?.toISOString() ?? null,
            history: ticket.history,
          }
        : null,
      signedDocument: signed
        ? {
            fileName: signed.fileName,
            size: signed.size,
            mime: signed.mimeType,
            extension: signed.extension,
            uploadedAt: signed.createdAt.toISOString(),
            uploadedBy: signed.uploadedByName,
            hash: signed.hash,
          }
        : null,
      contactedAt: item.contactedAt?.toISOString() ?? null,
      rejectReason: item.rejectReason,
      activatedAt: item.activatedAt?.toISOString() ?? null,
      /** Shu rolga hozir ko‘rinadigan amallar */
      availableActions: this.machine.availableActions(item.status, user.role).map((transition) => ({
        action: transition.action,
        label: transition.label,
      })),
    }
  }
}
