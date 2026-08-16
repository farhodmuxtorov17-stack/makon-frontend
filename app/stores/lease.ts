import { defineStore } from 'pinia'
import { BUILDINGS, buildingById } from '~/data/buildings'
import { UNITS, unitById } from '~/data/units'
import { CONTRACTS, INVOICES } from '~/data/business'
import { num } from '~/utils/format'
import { docxBlob, type DocxLine } from '~/utils/docx'

/**
 * Ijara sikli — bitta umumiy haqiqat manbasi.
 *
 * Ijarachi, bino rahbari va buxgalter ekranlari aynan shu do‘kondan o‘qiydi
 * va unga yozadi, shuning uchun uchala rol bir xil holatni ko‘radi va holat
 * sahifadan sahifaga o‘tganda saqlanib qoladi.
 *
 * Didox tashqi xizmat: tizim hujjatni yuboradi, holatni tekshiradi,
 * imzolangan faylni yuklab oladi va uni qaytadan yuklaydi. Imzo qo‘yish
 * jarayoni tizim ichida bajarilmaydi.
 */

export type LeaseStatus =
  | 'YANGI'
  | 'OPERATSIYA_TASDIQLADI'
  | 'MOLIYA_TASDIQLADI'
  | 'QORALAMA_TAYYOR'
  | 'DIDOX_YUBORILDI'
  | 'DIDOX_IMZOLANDI'
  | 'FAOL'
  | 'RAD_ETILDI'

/** Muvaffaqiyatli oqim tartibi — bosqich indeksini hisoblash uchun */
export const LEASE_FLOW: LeaseStatus[] = [
  'YANGI',
  'OPERATSIYA_TASDIQLADI',
  'MOLIYA_TASDIQLADI',
  'QORALAMA_TAYYOR',
  'DIDOX_YUBORILDI',
  'DIDOX_IMZOLANDI',
  'FAOL',
]

export type Periodicity = 'Oylik' | 'Choraklik' | 'Yillik'

export const PERIODICITY_MONTHS: Record<Periodicity, number> = {
  Oylik: 1,
  Choraklik: 3,
  Yillik: 12,
}

/** Didox tomonidagi holat — tizim uni faqat kuzatadi */
export type DidoxState = 'Yuborilgan' | 'Ko‘rib chiqilmoqda' | 'Imzolangan'

export const DIDOX_FLOW: DidoxState[] = ['Yuborilgan', 'Ko‘rib chiqilmoqda', 'Imzolangan']

export interface LeaseOrg {
  name: string
  tin: string
  director: string
  phone: string
  email: string
  address: string
}

export interface LeaseRequest {
  type: 'Ijaraga olish' | 'Sotib olish'
  /** Ijarachi taklif qilgan oylik narx, so‘m */
  offerPrice: number
  startDate: string
  /** Muddat, oy */
  term: number
  note: string
  submittedAt: string
}

export interface LeaseOffer {
  /** Oylik ijara narxi, so‘m */
  monthlyRent: number
  /** Kafolat depoziti, so‘m */
  deposit: number
  /** Servis to‘lovi, so‘m / m² / oy */
  servicePerSqm: number
  periodicity: Periodicity
  /** Buxgalter tuzatish kiritgan bo‘lsa — sababi */
  adjustmentReason: string
}

export interface SchedulePeriod {
  id: string
  kind: 'DEPOSIT' | 'RENT'
  label: string
  dueAt: string
  months: number
  rent: number
  service: number
  total: number
  status: 'PLANNED' | 'ISSUED' | 'PAID'
}

export interface ContractParty {
  role: string
  name: string
  tin: string
  director: string
  phone: string
  email: string
  address: string
}

export interface ContractDoc {
  code: string
  composedAt: string
  startsAt: string
  endsAt: string
  landlord: ContractParty
  tenant: ContractParty
  object: Array<{ label: string; value: string }>
  terms: Array<{ label: string; value: string }>
  clauses: Array<{ title: string; text: string }>
  schedule: SchedulePeriod[]
}

export interface DidoxTicket {
  /** Didox tizimidagi hujjat raqami */
  docNumber: string
  sentAt: string
  sentBy: string
  recipient: string
  recipientTin: string
  state: DidoxState
  lastCheckedAt: string | null
  history: Array<{ state: DidoxState; at: string; note: string }>
}

export interface SignedDocument {
  fileName: string
  size: number
  mime: string
  extension: string
  uploadedAt: string
  uploadedBy: string
  /** Yuklangan faylning haqiqiy SHA-256 nazorat yig‘indisi */
  hash: string
}

export interface AuditEntry {
  at: string
  actor: string
  roleLabel: string
  action: string
  detail: string
}

export interface ActivationChange {
  icon: string
  label: string
  detail: string
}

export interface LeaseCase {
  id: string
  code: string
  status: LeaseStatus
  unitId: string
  unitCode: string
  area: number
  floor: number
  usage: string
  buildingId: string
  buildingName: string
  buildingAddress: string
  org: LeaseOrg
  request: LeaseRequest
  offer: LeaseOffer | null
  schedule: SchedulePeriod[]
  contract: ContractDoc | null
  didox: DidoxTicket | null
  signedDocument: SignedDocument | null
  audit: AuditEntry[]
  contactedAt: string | null
  rejectReason: string
  activation: {
    at: string
    invoiceCode: string
    contractId: string
    changes: ActivationChange[]
  } | null
}

// ---------------------------------------------------------------------------
// Sana yordamchilari

const MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseIso(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!m) return new Date()
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function addMonths(iso: string, months: number) {
  const d = parseIso(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toIso(d)
}

function addDays(iso: string, days: number) {
  const d = parseIso(iso)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

/** "2026-08-16" → "16.08.2026" */
function dmy(iso: string) {
  const d = parseIso(iso)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

function monthLabel(iso: string) {
  const d = parseIso(iso)
  return `${MONTHS[d.getMonth()] ?? ''} ${d.getFullYear()}`
}

function now() {
  const d = new Date()
  return `${toIso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function today() {
  return toIso(new Date())
}

function money(value: number) {
  return `${num(Math.round(value))} so‘m`
}

// ---------------------------------------------------------------------------
// Ijaraga beruvchi tomon rekvizitlari

const LANDLORD: ContractParty = {
  role: 'Ijaraga beruvchi',
  name: 'Makon Property Group MCHJ',
  tin: '305 412 876',
  director: 'Azizbek Karimov',
  phone: '+998 78 150 00 00',
  email: 'info@makon.uz',
  address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
}

/** Aktivlashtirish natijasi ish vaqtida bir marta qo‘llanadi (qayta yuklashda ham) */
const appliedWorld = new Set<string>()

// ---------------------------------------------------------------------------
// Hisob-kitob

export function serviceTotalOf(offer: LeaseOffer, area: number) {
  return Math.round(offer.servicePerSqm * area)
}

export function buildSchedule(
  offer: LeaseOffer,
  request: Pick<LeaseRequest, 'startDate' | 'term'>,
  area: number,
): SchedulePeriod[] {
  const rows: SchedulePeriod[] = []
  const service = serviceTotalOf(offer, area)
  const step = PERIODICITY_MONTHS[offer.periodicity] ?? 1
  const term = Math.max(1, Math.round(request.term))

  if (offer.deposit > 0) {
    rows.push({
      id: 'dep',
      kind: 'DEPOSIT',
      label: 'Kafolat depoziti',
      dueAt: request.startDate,
      months: 0,
      rent: 0,
      service: 0,
      total: Math.round(offer.deposit),
      status: 'PLANNED',
    })
  }

  let i = 0
  let no = 1
  while (i < term) {
    const months = Math.min(step, term - i)
    const from = addMonths(request.startDate, i)
    const to = addDays(addMonths(request.startDate, i + months), -1)
    const rent = Math.round(offer.monthlyRent * months)
    const serviceSum = service * months
    rows.push({
      id: `p${no}`,
      kind: 'RENT',
      label: months === 1 ? monthLabel(from) : `${dmy(from)} – ${dmy(to)}`,
      dueAt: from,
      months,
      rent,
      service: serviceSum,
      total: rent + serviceSum,
      status: 'PLANNED',
    })
    i += months
    no += 1
  }

  return rows
}

export function scheduleTotals(schedule: SchedulePeriod[]) {
  const rent = schedule.filter((r) => r.kind === 'RENT')
  return {
    deposit: schedule.filter((r) => r.kind === 'DEPOSIT').reduce((s, r) => s + r.total, 0),
    rent: rent.reduce((s, r) => s + r.rent, 0),
    service: rent.reduce((s, r) => s + r.service, 0),
    total: rent.reduce((s, r) => s + r.total, 0),
    periods: rent.length,
  }
}

// ---------------------------------------------------------------------------
// Word hujjati

function contractLines(doc: ContractDoc): DocxLine[] {
  const lines: DocxLine[] = [
    { text: `IJARA SHARTNOMASI № ${doc.code}`, style: 'title' },
    { text: `Toshkent shahri · ${dmy(doc.composedAt)}`, style: 'subtitle' },
    { text: '1. TOMONLAR', style: 'heading' },
  ]

  for (const p of [doc.landlord, doc.tenant]) {
    lines.push({ text: `${p.role}: ${p.name}`, style: 'body' })
    lines.push({ text: `STIR: ${p.tin} · Vakil: ${p.director}`, style: 'small' })
    lines.push({ text: `Telefon: ${p.phone} · E-pochta: ${p.email}`, style: 'small' })
    lines.push({ text: `Manzil: ${p.address}`, style: 'small' })
  }

  lines.push({ text: '2. IJARA OBYEKTI', style: 'heading' })
  for (const r of doc.object) lines.push({ text: `${r.label}: ${r.value}` })

  lines.push({ text: '3. MOLIYAVIY SHARTLAR', style: 'heading' })
  for (const r of doc.terms) lines.push({ text: `${r.label}: ${r.value}` })

  lines.push({ text: '4. TO‘LOV GRAFIGI', style: 'heading' })
  for (const r of doc.schedule) {
    lines.push({ text: `${dmy(r.dueAt)} — ${r.label} — ${money(r.total)}`, style: 'small' })
  }

  lines.push({ text: '5. SHARTNOMA BANDLARI', style: 'heading' })
  doc.clauses.forEach((c, i) => {
    lines.push({ text: `5.${i + 1}. ${c.title}` })
    lines.push({ text: c.text, style: 'small' })
  })

  lines.push({ text: '6. TOMONLARNING REKVIZITLARI VA IMZOLARI', style: 'heading' })
  lines.push({ text: `${doc.landlord.role}: ${doc.landlord.name}` })
  lines.push({ text: `${doc.landlord.director} _______________________`, style: 'small' })
  lines.push({ text: `${doc.tenant.role}: ${doc.tenant.name}` })
  lines.push({ text: `${doc.tenant.director} _______________________`, style: 'small' })

  return lines
}

/** Shartnoma qoralamasi — haqiqiy Word fayli */
export function contractDocx(doc: ContractDoc): Blob {
  return docxBlob(contractLines(doc))
}

/** Didox’dan qaytgan imzolangan nusxa — imzo paneli qo‘shilgan hujjat */
export function signedContractDocx(doc: ContractDoc, ticket: DidoxTicket): Blob {
  const lines = contractLines(doc)
  lines.push({ text: 'DIDOX RAQAMLI IMZO QAYDNOMASI', style: 'heading' })
  lines.push({ text: `Didox hujjat raqami: ${ticket.docNumber}` })
  lines.push({ text: `Yuborilgan: ${ticket.sentAt}`, style: 'small' })
  for (const h of ticket.history) {
    lines.push({ text: `${h.at} — ${h.state}. ${h.note}`, style: 'small' })
  }
  lines.push({
    text: `Imzolovchi tomonlar: ${doc.landlord.name} (STIR ${doc.landlord.tin}) va ${doc.tenant.name} (STIR ${doc.tenant.tin}).`,
    style: 'small',
  })
  lines.push({
    text: 'Imzolar Didox platformasida qo‘yilgan. Ushbu nusxa MAKON tizimiga yuklash uchun mo‘ljallangan.',
    style: 'small',
  })
  return docxBlob(lines)
}

// ---------------------------------------------------------------------------
// Boshlang‘ich yozuvlar — reyestrda allaqachon mavjud arizalar

interface SeedInput {
  id: string
  code: string
  unitId: string
  org: LeaseOrg
  status: LeaseStatus
  submittedAt: string
  startDate: string
  term: number
  offerPrice: number
  note: string
  rejectReason?: string
  offer?: Partial<LeaseOffer>
}

const ORG_URBAN: LeaseOrg = {
  name: 'Urban Office MCHJ',
  tin: '307 219 645',
  director: 'Dilshod Ergashev',
  phone: '+998 90 567 89 01',
  email: 'd.ergashev@urbanoffice.uz',
  address: 'Toshkent shahri, Yunusobod tumani, Abdulla Qodiriy ko‘chasi 10',
}

const SEEDS: SeedInput[] = [
  {
    id: 'a-0156',
    code: 'ARZ-2026-0156',
    unitId: 'u-704',
    org: {
      name: 'Makon Solutions MCHJ',
      tin: '306 118 402',
      director: 'Bekzod Sultonov',
      phone: '+998 90 512 30 40',
      email: 'info@makonsolutions.uz',
      address: 'Toshkent shahri, Mirobod tumani, Shahrisabz ko‘chasi 14',
    },
    status: 'YANGI',
    submittedAt: '2026-08-12 10:30',
    startDate: '2026-09-01',
    term: 36,
    offerPrice: 10900000,
    note: 'Uch yillik muddatga ijaraga olmoqchimiz, dastlabki ko‘rikni tashkil qilishingizni so‘raymiz.',
  },
  {
    id: 'a-0155',
    code: 'ARZ-2026-0155',
    unitId: 'u-301',
    org: {
      name: 'Tech Solutions UZB MChJ',
      tin: '304 552 118',
      director: 'Sanjar Aliyev',
      phone: '+998 90 771 22 33',
      email: 's.aliyev@techsolutions.uz',
      address: 'Toshkent shahri, Chilonzor tumani, Bunyodkor shoh ko‘chasi 3',
    },
    status: 'OPERATSIYA_TASDIQLADI',
    submittedAt: '2026-08-11 14:05',
    startDate: '2026-09-01',
    term: 24,
    offerPrice: 18500000,
    note: 'Savdo nuqtasi ochish rejalashtirilgan. To‘lov shartlarini muhokama qilishni so‘raymiz.',
    offer: { monthlyRent: 18500000, deposit: 37000000, servicePerSqm: 21000, periodicity: 'Oylik' },
  },
  {
    id: 'a-0154',
    code: 'ARZ-2026-0154',
    unitId: 'u-b14',
    org: {
      name: 'Mega Invest Group',
      tin: '302 640 973',
      director: 'Aziz Nazarov',
      phone: '+998 90 882 44 55',
      email: 'a.nazarov@megainvest.uz',
      address: 'Toshkent viloyati, Yuqori Chirchiq tumani, Sanoat ko‘chasi 12',
    },
    status: 'YANGI',
    submittedAt: '2026-08-10 09:20',
    startDate: '2026-10-01',
    term: 60,
    offerPrice: 31000000,
    note: 'Logistika markazi uchun ombor maydoni kerak.',
  },
  {
    id: 'a-0153',
    code: 'ARZ-2026-0153',
    unitId: 'u-706',
    org: {
      name: 'Creative Agency',
      tin: '303 981 264',
      director: 'Kamola Yusupova',
      phone: '+998 90 993 66 77',
      email: 'k.yusupova@creative.uz',
      address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
    },
    status: 'OPERATSIYA_TASDIQLADI',
    submittedAt: '2026-08-06 16:40',
    startDate: '2026-09-01',
    term: 12,
    offerPrice: 11200000,
    note: 'Joriy ofisdan kengaytirish maqsadida qo‘shimcha maydon.',
    offer: {
      monthlyRent: 11200000,
      deposit: 22400000,
      servicePerSqm: 18000,
      periodicity: 'Choraklik',
    },
  },
  {
    id: 'a-0152',
    code: 'ARZ-2026-0152',
    unitId: 'u-402',
    org: {
      name: 'Alpha Solutions',
      tin: '309 447 130',
      director: 'Rustam Qodirov',
      phone: '+998 90 445 88 99',
      email: 'r.qodirov@alpha.uz',
      address: 'Toshkent shahri, Yunusobod tumani, Abdulla Qodiriy ko‘chasi 10',
    },
    status: 'RAD_ETILDI',
    submittedAt: '2026-08-04 11:15',
    startDate: '2026-09-01',
    term: 24,
    offerPrice: 13400000,
    note: 'Vakillik ofisi uchun maydon so‘raladi.',
    rejectReason: 'Talab qilingan muddat bo‘sh maydon rejasiga to‘g‘ri kelmadi.',
  },
  {
    id: 'a-0151',
    code: 'ARZ-2026-0151',
    unitId: 'u-702',
    org: ORG_URBAN,
    status: 'OPERATSIYA_TASDIQLADI',
    submittedAt: '2026-08-09 12:40',
    startDate: '2026-09-01',
    term: 24,
    offerPrice: 11800000,
    note: 'Qo‘shni maydonni qo‘shimcha ish o‘rinlari uchun ijaraga olish rejalashtirilgan.',
    offer: { monthlyRent: 11800000, deposit: 23600000, servicePerSqm: 18000, periodicity: 'Oylik' },
  },
  {
    id: 'a-0142',
    code: 'ARZ-2026-0142',
    unitId: 'u-505',
    org: ORG_URBAN,
    status: 'RAD_ETILDI',
    submittedAt: '2026-07-15 09:30',
    startDate: '2026-08-01',
    term: 12,
    offerPrice: 74445000,
    note: 'Katta ochiq maydon so‘ralgan.',
    rejectReason: 'So‘ralgan muddat bino bo‘sh maydon rejasiga to‘g‘ri kelmadi.',
  },
]

function seedCase(seed: SeedInput): LeaseCase | null {
  const unit = unitById(seed.unitId)
  if (!unit) return null
  const building = buildingById(unit.buildingId)
  if (!building) return null

  const request: LeaseRequest = {
    type: 'Ijaraga olish',
    offerPrice: seed.offerPrice,
    startDate: seed.startDate,
    term: seed.term,
    note: seed.note,
    submittedAt: seed.submittedAt,
  }

  const offer: LeaseOffer | null = seed.offer
    ? {
        monthlyRent: seed.offer.monthlyRent ?? seed.offerPrice,
        deposit: seed.offer.deposit ?? 0,
        servicePerSqm: seed.offer.servicePerSqm ?? 0,
        periodicity: seed.offer.periodicity ?? 'Oylik',
        adjustmentReason: '',
      }
    : null

  const audit: AuditEntry[] = [
    {
      at: seed.submittedAt,
      actor: seed.org.director,
      roleLabel: 'Ijarachi',
      action: 'Ariza yuborildi',
      detail: `${unit.code} uniti bo‘yicha ${seed.term} oylik ijara so‘rovi`,
    },
  ]

  if (seed.status === 'OPERATSIYA_TASDIQLADI') {
    audit.push({
      at: `${addDays(seed.submittedAt.slice(0, 10), 1)} 09:15`,
      actor: building.manager,
      roleLabel: 'Bino rahbari',
      action: 'Operatsiya tasdiqladi',
      detail: 'Kelishilgan shartlar kiritildi va to‘lov grafigi hisoblandi',
    })
  }

  if (seed.status === 'RAD_ETILDI') {
    audit.push({
      at: `${addDays(seed.submittedAt.slice(0, 10), 2)} 11:20`,
      actor: building.manager,
      roleLabel: 'Bino rahbari',
      action: 'Ariza rad etildi',
      detail: seed.rejectReason ?? '',
    })
  }

  return {
    id: seed.id,
    code: seed.code,
    status: seed.status,
    unitId: unit.id,
    unitCode: unit.code,
    area: unit.area,
    floor: unit.floor,
    usage: unit.usage,
    buildingId: building.id,
    buildingName: building.name,
    buildingAddress: `${building.city}, ${building.district}, ${building.street}`,
    org: seed.org,
    request,
    offer,
    schedule: offer ? buildSchedule(offer, request, unit.area) : [],
    contract: null,
    didox: null,
    signedDocument: null,
    audit,
    contactedAt: seed.status === 'OPERATSIYA_TASDIQLADI' ? seed.submittedAt : null,
    rejectReason: seed.rejectReason ?? '',
    activation: null,
  }
}

// ---------------------------------------------------------------------------

export const useLeaseStore = defineStore('lease', {
  state: () => ({
    cases: [] as LeaseCase[],
    seeded: false,
    caseSequence: 156,
    contractSequence: 161,
    invoiceSequence: 700,
    didoxSequence: 48210,
  }),

  getters: {
    byId: (s) => (id: string) => s.cases.find((c) => c.id === id) ?? null,

    /** Qaror kutayotgan yozuvlar */
    pending: (s) => s.cases.filter((c) => c.status !== 'FAOL' && c.status !== 'RAD_ETILDI'),

    /** Ijarachi kabineti faqat o‘z tashkiloti yozuvlarini ko‘radi */
    forOrganization: (s) => (name: string) => s.cases.filter((c) => c.org.name === name),

    activeCases: (s) => s.cases.filter((c) => c.status === 'FAOL'),
  },

  actions: {
    /** Boshlang‘ich yozuvlar bir marta yoziladi */
    seed() {
      if (this.seeded) return
      this.cases = SEEDS.map(seedCase).filter((c): c is LeaseCase => c !== null)
      this.seeded = true
    },

    log(item: LeaseCase, entry: Omit<AuditEntry, 'at'>) {
      item.audit.push({ at: now(), ...entry })
    },

    /** Ijarachi yangi ariza yuboradi */
    createCase(input: {
      unitId: string
      org: LeaseOrg
      offerPrice: number
      startDate: string
      term: number
      note: string
      type?: LeaseRequest['type']
    }): LeaseCase | null {
      const unit = unitById(input.unitId)
      if (!unit) return null
      const building = buildingById(unit.buildingId)
      if (!building) return null

      this.caseSequence += 1
      const stamp = now()

      const item: LeaseCase = {
        id: `a-0${this.caseSequence}`,
        code: `ARZ-2026-0${this.caseSequence}`,
        status: 'YANGI',
        unitId: unit.id,
        unitCode: unit.code,
        area: unit.area,
        floor: unit.floor,
        usage: unit.usage,
        buildingId: building.id,
        buildingName: building.name,
        buildingAddress: `${building.city}, ${building.district}, ${building.street}`,
        org: { ...input.org },
        request: {
          type: input.type ?? 'Ijaraga olish',
          offerPrice: input.offerPrice,
          startDate: input.startDate,
          term: input.term,
          note: input.note,
          submittedAt: stamp,
        },
        offer: null,
        schedule: [],
        contract: null,
        didox: null,
        signedDocument: null,
        audit: [],
        contactedAt: null,
        rejectReason: '',
        activation: null,
      }

      this.log(item, {
        actor: input.org.director,
        roleLabel: 'Ijarachi',
        action: 'Ariza yuborildi',
        detail: `${building.name} · Unit ${unit.code} · ${input.term} oy · ${money(input.offerPrice)}`,
      })

      this.cases.unshift(item)
      return item
    },

    markContacted(id: string, actor: string, roleLabel: string) {
      const item = this.byId(id)
      if (!item || item.contactedAt) return
      item.contactedAt = now()
      this.log(item, {
        actor,
        roleLabel,
        action: 'Bog‘lanildi',
        detail: `${item.org.director} bilan ${item.org.phone} raqami orqali gaplashildi`,
      })
    },

    /** Kelishilgan shartlar saqlanadi va to‘lov grafigi qayta hisoblanadi */
    saveOffer(id: string, offer: LeaseOffer) {
      const item = this.byId(id)
      if (!item) return
      item.offer = { ...offer }
      item.schedule = buildSchedule(item.offer, item.request, item.area)
    },

    approveOperation(id: string, actor: string, offer: LeaseOffer) {
      const item = this.byId(id)
      if (!item || item.status !== 'YANGI') return
      this.saveOffer(id, offer)
      item.status = 'OPERATSIYA_TASDIQLADI'
      const totals = scheduleTotals(item.schedule)
      this.log(item, {
        actor,
        roleLabel: 'Bino rahbari',
        action: 'Operatsiya tasdiqladi',
        detail: `Oylik ijara ${money(offer.monthlyRent)}, depozit ${money(offer.deposit)}, ${totals.periods} ta to‘lov davri`,
      })
    },

    /** Buxgalter moliyaviy shartlarni tasdiqlaydi — qoralama darhol tuziladi */
    approveFinance(id: string, actor: string, offer: LeaseOffer) {
      const item = this.byId(id)
      if (!item || item.status !== 'OPERATSIYA_TASDIQLADI') return

      const before = item.offer
      const changed =
        !before ||
        before.monthlyRent !== offer.monthlyRent ||
        before.deposit !== offer.deposit ||
        before.servicePerSqm !== offer.servicePerSqm ||
        before.periodicity !== offer.periodicity

      this.saveOffer(id, offer)
      item.status = 'MOLIYA_TASDIQLADI'

      const totals = scheduleTotals(item.schedule)
      this.log(item, {
        actor,
        roleLabel: 'Buxgalter',
        action: 'Moliya tasdiqladi',
        detail:
          changed && offer.adjustmentReason
            ? `Shartlar tuzatildi: ${offer.adjustmentReason}. Shartnoma summasi ${money(totals.total)}`
            : `Shartlar o‘zgarishsiz tasdiqlandi. Shartnoma summasi ${money(totals.total)}`,
      })

      this.composeContract(id)
    },

    /** Tizim shartnoma qoralamasini tuzadi */
    composeContract(id: string) {
      const item = this.byId(id)
      if (!item || !item.offer) return

      this.contractSequence += 1
      const code = `MKON-2026-0${this.contractSequence}`
      const startsAt = item.request.startDate
      const endsAt = addDays(addMonths(startsAt, item.request.term), -1)
      const service = serviceTotalOf(item.offer, item.area)
      const totals = scheduleTotals(item.schedule)

      const doc: ContractDoc = {
        code,
        composedAt: today(),
        startsAt,
        endsAt,
        landlord: LANDLORD,
        tenant: {
          role: 'Ijarachi',
          name: item.org.name,
          tin: item.org.tin,
          director: item.org.director,
          phone: item.org.phone,
          email: item.org.email,
          address: item.org.address,
        },
        object: [
          { label: 'Obyekt', value: item.buildingName },
          { label: 'Manzil', value: item.buildingAddress },
          { label: 'Unit raqami', value: item.unitCode },
          { label: 'Qavat', value: `${item.floor}-qavat` },
          { label: 'Maydon', value: `${item.area.toFixed(2)} m²` },
          { label: 'Foydalanish turi', value: item.usage },
        ],
        terms: [
          { label: 'Oylik ijara narxi', value: money(item.offer.monthlyRent) },
          { label: 'Kafolat depoziti', value: money(item.offer.deposit) },
          {
            label: 'Servis to‘lovi',
            value: `${money(item.offer.servicePerSqm)} / m² / oy — jami ${money(service)}`,
          },
          { label: 'To‘lov davriyligi', value: item.offer.periodicity },
          { label: 'Muddat', value: `${item.request.term} oy` },
          { label: 'Boshlanish sanasi', value: dmy(startsAt) },
          { label: 'Tugash sanasi', value: dmy(endsAt) },
          { label: 'Shartnoma bo‘yicha jami summa', value: money(totals.total) },
        ],
        clauses: [
          {
            title: 'Shartnoma predmeti',
            text: `Ijaraga beruvchi ${item.buildingName} binosidagi ${item.unitCode}-unitni (${item.area.toFixed(2)} m²) Ijarachiga vaqtinchalik egalik va foydalanishga topshiradi, Ijarachi esa belgilangan to‘lovlarni o‘z vaqtida amalga oshiradi.`,
          },
          {
            title: 'To‘lov tartibi',
            text: `To‘lovlar ${item.offer.periodicity.toLowerCase()} tartibda, har bir davr boshlanishidan oldin ilova qilingan grafik bo‘yicha amalga oshiriladi. Servis to‘lovi maydonga nisbatan hisoblanadi va ijara to‘lovi bilan birga undiriladi.`,
          },
          {
            title: 'Kafolat depoziti',
            text: `Ijarachi shartnoma imzolangan sanadan boshlab 5 bank kuni ichida ${money(item.offer.deposit)} miqdorida kafolat depozitini o‘tkazadi. Depozit shartnoma tugagach, qarzdorlik bo‘lmasa, to‘liq qaytariladi.`,
          },
          {
            title: 'Tomonlar majburiyatlari',
            text: 'Ijaraga beruvchi muhandislik tizimlarining ishlashini va umumiy maydonlarga xizmat ko‘rsatishni ta’minlaydi. Ijarachi maydondan maqsadli foydalanadi, yong‘in va sanitariya talablariga rioya qiladi.',
          },
          {
            title: 'Amal qilish muddati',
            text: `Shartnoma ${dmy(startsAt)} dan ${dmy(endsAt)} gacha amal qiladi. Muddat tugashidan 30 kun oldin tomonlar uzaytirish yuzasidan qaror qabul qiladi.`,
          },
          {
            title: 'Imzolash tartibi',
            text: 'Shartnoma Didox platformasi orqali imzolanadi. Imzolangan nusxa MAKON tizimiga yuklanadi va uning SHA-256 nazorat yig‘indisi hujjat butunligini tasdiqlaydi.',
          },
        ],
        schedule: item.schedule.map((r) => ({ ...r })),
      }

      item.contract = doc
      item.status = 'QORALAMA_TAYYOR'
      this.log(item, {
        actor: 'Tizim',
        roleLabel: 'Avtomatik',
        action: 'Shartnoma qoralamasi tuzildi',
        detail: `${code} — ${item.request.term} oy, ${money(totals.total)} (DOCX)`,
      })
    },

    /** 6-bosqich: hujjat Didox’ga yuboriladi */
    sendToDidox(id: string, actor: string) {
      const item = this.byId(id)
      if (!item || !item.contract || item.status !== 'QORALAMA_TAYYOR') return

      this.didoxSequence += 1
      const stamp = now()

      item.didox = {
        docNumber: `DX-2026-${this.didoxSequence}`,
        sentAt: stamp,
        sentBy: actor,
        recipient: item.org.name,
        recipientTin: item.org.tin,
        state: 'Yuborilgan',
        lastCheckedAt: null,
        history: [
          {
            state: 'Yuborilgan',
            at: stamp,
            note: `Hujjat ${item.org.name} tashkilotiga imzolash uchun yuborildi`,
          },
        ],
      }

      item.status = 'DIDOX_YUBORILDI'
      this.log(item, {
        actor,
        roleLabel: 'Bino rahbari',
        action: 'Didox orqali yuborildi',
        detail: `${item.contract.code} · Didox hujjat raqami ${item.didox.docNumber}`,
      })
    },

    /** 7-bosqich: Didox tomonidagi holat tekshiriladi */
    checkDidox(id: string, actor: string) {
      const item = this.byId(id)
      if (!item || !item.didox) return
      const ticket = item.didox
      const stamp = now()
      ticket.lastCheckedAt = stamp

      const i = DIDOX_FLOW.indexOf(ticket.state)
      const next = DIDOX_FLOW[i + 1]
      if (!next) return

      const note =
        next === 'Ko‘rib chiqilmoqda'
          ? `${item.org.name} hujjatni ochdi va ko‘rib chiqmoqda`
          : `Hujjat ikkala tomon tomonidan imzolandi va Didox’da yakunlandi`

      ticket.state = next
      ticket.history.push({ state: next, at: stamp, note })

      this.log(item, {
        actor,
        roleLabel: 'Bino rahbari',
        action: 'Didox holati tekshirildi',
        detail: `${ticket.docNumber} — yangi holat: ${next}`,
      })

      if (next === 'Imzolangan') item.status = 'DIDOX_IMZOLANDI'
    },

    /** 8-bosqich: Didox’dan olingan imzolangan fayl tizimga yuklanadi */
    attachSignedDocument(id: string, actor: string, file: Omit<SignedDocument, 'uploadedAt' | 'uploadedBy'>) {
      const item = this.byId(id)
      if (!item || item.status !== 'DIDOX_IMZOLANDI') return
      item.signedDocument = { ...file, uploadedAt: now(), uploadedBy: actor }
      this.log(item, {
        actor,
        roleLabel: 'Bino rahbari',
        action: 'Imzolangan hujjat yuklandi',
        detail: `${file.fileName} · SHA-256: ${file.hash.slice(0, 16)}…`,
      })
    },

    removeSignedDocument(id: string, actor: string) {
      const item = this.byId(id)
      if (!item || !item.signedDocument || item.status === 'FAOL') return
      const name = item.signedDocument.fileName
      item.signedDocument = null
      this.log(item, {
        actor,
        roleLabel: 'Bino rahbari',
        action: 'Yuklangan hujjat olib tashlandi',
        detail: name,
      })
    },

    reject(id: string, actor: string, roleLabel: string, reason: string) {
      const item = this.byId(id)
      if (!item) return
      item.status = 'RAD_ETILDI'
      item.rejectReason = reason
      this.log(item, { actor, roleLabel, action: 'Ariza rad etildi', detail: reason })
    },

    /** Oldingi bosqichga qaytarish — sabab bilan */
    returnForRework(id: string, actor: string, roleLabel: string, reason: string) {
      const item = this.byId(id)
      if (!item) return
      const i = LEASE_FLOW.indexOf(item.status)
      item.status = i > 0 ? (LEASE_FLOW[i - 1] as LeaseStatus) : 'YANGI'
      this.log(item, {
        actor,
        roleLabel,
        action: 'Qayta ishlashga yuborildi',
        detail: reason,
      })
    },

    activate(id: string, actor: string) {
      const item = this.byId(id)
      if (!item || !item.contract || !item.offer) return null
      if (item.status !== 'DIDOX_IMZOLANDI' || !item.signedDocument) return null

      const building = buildingById(item.buildingId)
      const totals = scheduleTotals(item.schedule)
      const first = item.schedule.find((r) => r.kind === 'RENT')

      this.invoiceSequence += 1
      const invoiceCode = `INV-2026-0${this.invoiceSequence}`
      const contractId = `c-0${this.contractSequence}`

      if (first) first.status = 'ISSUED'

      const changes: ActivationChange[] = [
        {
          icon: 'building',
          label: 'Unit holati «Band» ga o‘tdi',
          detail: `${item.buildingName} · Unit ${item.unitCode} — ${item.org.name} nomiga rasmiylashtirildi`,
        },
        {
          icon: 'eye',
          label: 'Unit ommaviy katalogdan olib tashlandi',
          detail: 'Bo‘sh joylar katalogida va xaritada endi ko‘rinmaydi',
        },
        {
          icon: 'chart',
          label: 'Bino statistikasi qayta hisoblandi',
          detail: '',
        },
        {
          icon: 'contract',
          label: `Shartnoma ${item.contract.code} faollashtirildi`,
          detail: `Ijarachi kabinetiga shartnoma, unit va to‘lov grafigi qo‘shildi (${totals.periods} ta davr)`,
        },
        {
          icon: 'wallet',
          label: `Birinchi hisob-faktura ${invoiceCode} yaratildi`,
          detail: first
            ? `${first.label} · ${money(first.total)} · to‘lov muddati ${dmy(first.dueAt)}`
            : '',
        },
      ]

      item.status = 'FAOL'
      item.activation = { at: now(), invoiceCode, contractId, changes }

      this.log(item, {
        actor,
        roleLabel: 'Bino rahbari',
        action: 'Shartnoma faollashtirildi',
        detail: `Unit band qilindi, ${invoiceCode} hisob-fakturasi va oylik billing grafigi ishga tushdi`,
      })

      this.applyCase(item)

      if (building) {
        changes[2]!.detail = `Bandlik ${building.occupancy}% · bo‘sh maydon ${num(Math.round(building.vacantArea))} m² · bo‘sh unitlar ${building.vacantUnits} ta`
      }

      return item.activation
    },

    /**
     * Faol yozuvni reyestrga qo‘llaydi: unit bandligi, bino statistikasi,
     * shartnoma va hisob-faktura. Sahifa qayta yuklanganda ham bir marta
     * bajariladi, shuning uchun ko‘rsatkichlar ikki marta hisoblanmaydi.
     */
    applyCase(item: LeaseCase) {
      const doc = item.contract
      const activation = item.activation
      if (!doc || !activation) return
      if (appliedWorld.has(item.id)) return
      appliedWorld.add(item.id)

      const unit = UNITS.find((u) => u.id === item.unitId)
      if (unit && unit.status !== 'RENTED') {
        unit.status = 'RENTED'
        unit.tenant = item.org.name
        unit.contractCode = doc.code

        const building = BUILDINGS.find((b) => b.id === item.buildingId)
        if (building) {
          building.vacantUnits = Math.max(0, building.vacantUnits - 1)
          building.occupiedUnits += 1
          building.vacantArea = Math.max(0, Math.round(building.vacantArea - unit.area))
          building.occupancy = building.gla
            ? Math.round(((building.gla - building.vacantArea) / building.gla) * 100)
            : building.occupancy
        }
      }

      const totals = scheduleTotals(item.schedule)
      const contractId = activation.contractId

      if (!CONTRACTS.some((c) => c.id === contractId)) {
        CONTRACTS.unshift({
          id: contractId,
          code: doc.code,
          type: 'Ijara',
          tenant: item.org.name,
          buildingId: item.buildingId,
          buildingName: item.buildingName,
          unitCode: `Unit ${item.unitCode}`,
          startsAt: doc.startsAt,
          endsAt: doc.endsAt,
          status: 'ACTIVE',
          amount: totals.total,
          paymentTerm: `${item.offer?.periodicity ?? 'Oylik'} oldindan to‘lov`,
          documents: [
            {
              name: item.signedDocument?.fileName ?? `${doc.code}.docx`,
              size: item.signedDocument ? `${Math.round(item.signedDocument.size / 1024)} KB` : '—',
              type: item.signedDocument?.extension === 'pdf' ? 'pdf' : 'docx',
            },
            { name: 'To‘lov jadvali.xlsx', size: '286 KB', type: 'xlsx' },
          ],
          timeline: item.audit.map((a) => ({
            label: a.action,
            date: a.at.slice(0, 10),
            actor: a.actor,
            done: true,
          })),
        })
      }

      const first = item.schedule.find((r) => r.kind === 'RENT')
      if (first && !INVOICES.some((i) => i.code === activation.invoiceCode)) {
        INVOICES.unshift({
          id: `i-${activation.invoiceCode.slice(-4)}`,
          code: activation.invoiceCode,
          tenant: item.org.name,
          buildingName: item.buildingName,
          unitCode: `Unit ${item.unitCode}`,
          period: first.label,
          issuedAt: activation.at.slice(0, 10),
          dueAt: first.dueAt,
          total: first.total,
          paid: 0,
          status: 'ISSUED',
          agingBucket: '0-30',
        })
      }
    },

    /** Saqlangan holat qayta tiklangandan keyin reyestrni moslashtiradi */
    syncWorld() {
      this.seed()
      for (const item of this.cases) {
        if (item.status === 'FAOL') this.applyCase(item)
      }
    },
  },

  /**
   * Ijara yozuvlari (shartnoma matni va to‘lov grafiklari bilan) cookie
   * hajmidan katta, shuning uchun ular brauzer xotirasida saqlanadi.
   */
  persist: {
    storage: piniaPluginPersistedstate.localStorage(),
  },
})

export { dmy as leaseDate, money as leaseMoney, monthLabel as leaseMonth }
