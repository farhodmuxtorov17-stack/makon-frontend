import { defineStore } from 'pinia'
import { BUILDINGS, buildingById } from '~/data/buildings'
import { UNITS, unitById } from '~/data/units'
import { agingKeyOf, statusOf, CONTRACTS, INVOICES, type Invoice } from '~/data/business'
import { formatStir, organizationByStir, stirDigits, LANDLORD_STIR } from '~/data/organizations'
import { UNIT_STATUS } from '~/constants/statuses'
import { num, todayIso } from '~/utils/format'
import { docxBlob, type DocxLine } from '~/utils/docx'

/**
 * Ijara sikli: bitta umumiy haqiqat manbasi.
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

/** Muvaffaqiyatli oqim tartibi, bosqich indeksini hisoblash uchun */
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

/** Didox tomonidagi holat, tizim uni faqat kuzatadi */
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
  /** Buxgalter tuzatish kiritgan bo‘lsa, sababi */
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
  /** Davr uchun chiqarilgan hisob-faktura raqami, chiqarilmagan davrda bo‘sh */
  invoiceCode?: string
}

export interface ContractParty {
  role: string
  name: string
  tin: string
  director: string
  phone: string
  email: string
  address: string
  /** Bank nomi va filiali, tashkilotlar reyestridan olinadi */
  bank: string
  /** Hisob raqami */
  account: string
  /** Bank kodi; reyestrda topilmasa bo‘sh qoladi */
  mfo: string
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
  /** Ariza hisobsiz, ochiq forma orqali yuborilgan */
  guest: boolean
  /** Ariza yuborgan shaxs ismi, tashkilot rahbaridan farq qilishi mumkin */
  contactName: string
  /** Operator kabinet ochishni taklif qilgan vaqt */
  accountInvitedAt: string | null
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
// Hujjat kodlari: prefiks, joriy yil va reyestr bo‘yicha yagona ketma-ketlik

/**
 * Kod generatori bitta joyda turadi: reyestrdagi eng katta raqamdan davom
 * etadi va yilni tizim sanasidan oladi. Shu sababli ijara oqimi va shartnoma
 * reyestri bir xil yilni va bir-birini bosmaydigan raqamlarni beradi.
 */
function nextCode(prefix: string, used: Array<string | undefined>): string {
  let max = 0
  for (const code of used) {
    const m = /(\d+)$/.exec(String(code ?? ''))
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}-${todayIso().slice(0, 4)}-${String(max + 1).padStart(4, '0')}`
}

/** Reyestrdagi va hali faollashmagan qoralamalardagi kodlardan keyingi raqam */
export function nextContractCode(extra: Array<string | undefined> = []): string {
  return nextCode('MKON', [...CONTRACTS.map((c) => c.code), ...extra])
}

/** Hisob-faktura raqami: billing reyestridagi eng katta raqamdan keyingisi */
export function nextInvoiceCode(extra: Array<string | undefined> = []): string {
  return nextCode('INV', [...INVOICES.map((i) => i.code), ...extra])
}

// ---------------------------------------------------------------------------
// Tomonlar rekvizitlari

/**
 * Bank kodlari (MFO) namunaviy ma’lumotnomasi: tashkilotlar reyestrida bank
 * nomi va hisob raqami bor, kod esa yo‘q. Reyestrda bo‘lmagan bank uchun kod
 * bo‘sh qoladi va shartnomada «tomon tomonidan to‘ldiriladi» deb ko‘rsatiladi.
 */
const BANK_MFO: Record<string, string> = {
  'Agrobank ATB, Yashnobod filiali': '00987',
  'Aloqabank ATB, Mirobod filiali': '00401',
  'Asakabank ATB, Toshkent viloyat filiali': '00419',
  'Davr Bank ATB, Yunusobod filiali': '01088',
  'Hamkorbank ATB, Mirobod filiali': '00083',
  'Hamkorbank ATB, Sergeli filiali': '00085',
  'InFinBank ATB, Mirobod filiali': '00434',
  'Ipoteka Bank ATIB, Mirobod filiali': '00443',
  'Ipoteka Bank ATIB, Toshkent shahar filiali': '00445',
  'Kapitalbank ATB, Chilonzor filiali': '00974',
  'Kapitalbank ATB, Olmazor filiali': '00976',
  'Trastbank ATB, Uchtepa filiali': '00491',
  'Turonbank ATB, Zangiota filiali': '00358',
  'Universal Bank ATB, Mirzo Ulug‘bek filiali': '01041',
  'Xalq banki ATB, Shayxontohur filiali': '00279',
}

/** Shartnoma tomoni: bank rekvizitlari tashkilotlar reyestridan qo‘shiladi */
function partyOf(role: string, org: LeaseOrg): ContractParty {
  const record = organizationByStir(stirDigits(org.tin))
  const bank = record?.bank ?? ''
  return {
    role,
    name: org.name,
    tin: org.tin,
    director: org.director,
    phone: org.phone,
    email: org.email,
    address: org.address,
    bank,
    account: record?.account ?? '',
    mfo: bank ? (BANK_MFO[bank] ?? '') : '',
  }
}

const LANDLORD_ORG = organizationByStir(LANDLORD_STIR)

const LANDLORD: ContractParty = partyOf('Ijaraga beruvchi', {
  name: LANDLORD_ORG?.name ?? 'Makon Property Group MCHJ',
  tin: formatStir(LANDLORD_STIR),
  director: LANDLORD_ORG?.director ?? 'Azizbek Karimov',
  phone: LANDLORD_ORG?.phone ?? '+998 78 150 00 00',
  email: LANDLORD_ORG?.email ?? 'info@makon.uz',
  address: LANDLORD_ORG?.address ?? 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
})

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
    lines.push({ text: `${dmy(r.dueAt)}, ${r.label}: ${money(r.total)}`, style: 'small' })
  }

  lines.push({ text: '5. SHARTNOMA BANDLARI', style: 'heading' })
  doc.clauses.forEach((c, i) => {
    lines.push({ text: `5.${i + 1}. ${c.title}` })
    lines.push({ text: c.text, style: 'small' })
  })

  lines.push({ text: '6. TOMONLARNING REKVIZITLARI VA IMZOLARI', style: 'heading' })
  for (const p of [doc.landlord, doc.tenant]) {
    lines.push({ text: `${p.role}: ${p.name}` })
    lines.push({ text: `STIR: ${p.tin}`, style: 'small' })
    lines.push({ text: `Yuridik manzil: ${p.address}`, style: 'small' })
    lines.push({
      text: p.bank ? `Bank: ${p.bank}` : 'Bank: shartnoma imzolashda tomon tomonidan to‘ldiriladi',
      style: 'small',
    })
    lines.push({
      text: `Hisob raqami (h/r): ${p.account || 'to‘ldiriladi'} · MFO: ${p.mfo || 'to‘ldiriladi'}`,
      style: 'small',
    })
    lines.push({ text: `Telefon: ${p.phone} · E-pochta: ${p.email}`, style: 'small' })
    lines.push({ text: `${p.director}  _______________________  M.O‘.`, style: 'small' })
  }

  return lines
}

/** Shartnoma qoralamasi: haqiqiy Word fayli */
export function contractDocx(doc: ContractDoc): Blob {
  return docxBlob(contractLines(doc))
}

/** Didox’dan qaytgan imzolangan nusxa, imzo paneli qo‘shilgan hujjat */
export function signedContractDocx(doc: ContractDoc, ticket: DidoxTicket): Blob {
  const lines = contractLines(doc)
  lines.push({ text: 'DIDOX RAQAMLI IMZO QAYDNOMASI', style: 'heading' })
  lines.push({ text: `Didox hujjat raqami: ${ticket.docNumber}` })
  lines.push({ text: `Yuborilgan: ${ticket.sentAt}`, style: 'small' })
  for (const h of ticket.history) {
    lines.push({ text: `${h.at}, ${h.state}. ${h.note}`, style: 'small' })
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
// Boshlang‘ich yozuvlar: reyestrda allaqachon mavjud arizalar

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
    guest: false,
    contactName: seed.org.director,
    accountInvitedAt: null,
    activation: null,
  }
}

// ---------------------------------------------------------------------------

export const useLeaseStore = defineStore('lease', {
  state: () => ({
    cases: [] as LeaseCase[],
    seeded: false,
    caseSequence: 156,
    /*
     * Shartnoma va hisob-faktura raqamlari reyestrdagi eng katta raqamdan
     * hisoblanadi (`nextContractCode`, `nextInvoiceCode`), shuning uchun bu
     * yerda alohida hisoblagich saqlanmaydi. Didox raqami tashqi xizmatniki.
     */
    didoxSequence: 48210,
  }),

  getters: {
    byId: (s) => (id: string) => s.cases.find((c) => c.id === id) ?? null,

    /** Ariza raqami bo‘yicha, kuzatuv sahifasi shu orqali topadi */
    byCode: (s) => (code: string) => {
      const key = String(code ?? '').trim().toUpperCase()
      return s.cases.find((c) => c.code.toUpperCase() === key) ?? null
    },

    /** Hisobsiz yuborilgan, hali kabinetga bog‘lanmagan arizalar */
    guestCases: (s) => s.cases.filter((c) => c.guest),

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
      /** Ariza ochiq forma orqali, hisobsiz yuborilgan */
      guest?: boolean
      /** Ariza yuborgan shaxs ismi */
      contactName?: string
    }): LeaseCase | null {
      const unit = unitById(input.unitId)
      if (!unit) return null
      const building = buildingById(unit.buildingId)
      if (!building) return null

      /*
       * So‘rov turi unitning taklif turidan aniqlanadi: faqat sotuvga
       * qo‘yilgan maydon bo‘yicha ijara arizasi ochilmaydi, aks holda sotuv
       * so‘rovi oxirida ijara shartnomasi tuzilib qolar edi.
       */
      const type: LeaseRequest['type'] =
        input.type === 'Sotib olish' || unit.offer === 'Sotuv' ? 'Sotib olish' : 'Ijaraga olish'

      const code = nextCode('ARZ', this.cases.map((c) => c.code))
      const stamp = now()

      const item: LeaseCase = {
        id: `a-${code.slice(-4)}`,
        code,
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
          type,
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
        guest: input.guest === true,
        contactName: input.contactName?.trim() || input.org.director,
        accountInvitedAt: null,
        activation: null,
      }

      const terms =
        type === 'Sotib olish'
          ? `sotib olish taklifi ${money(input.offerPrice)}`
          : `${input.term} oy · ${money(input.offerPrice)}`

      this.log(item, {
        actor: item.contactName,
        roleLabel: item.guest ? 'Mijoz, hisobsiz' : 'Ijarachi',
        action: type === 'Sotib olish' ? 'Sotib olish so‘rovi yuborildi' : 'Ariza yuborildi',
        detail: `${building.name} · Unit ${unit.code} · ${terms}${
          item.guest ? ' · telefon raqami tasdiqlangan' : ''
        }`,
      })

      this.cases.unshift(item)
      return item
    },

    /**
     * Operator hisobsiz mijozga kabinet ochishni taklif qiladi. Belgilangandan
     * so‘ng mijoz ariza raqami bilan parol o‘rnatishi mumkin bo‘ladi.
     */
    inviteAccount(id: string, actor: string, roleLabel: string) {
      const item = this.byId(id)
      if (!item || !item.guest || item.accountInvitedAt) return
      item.accountInvitedAt = now()
      this.log(item, {
        actor,
        roleLabel,
        action: 'Kabinet yaratish taklif qilindi',
        detail: `${item.contactName} (${item.org.phone}) parol o‘rnatib kabinetga kira oladi`,
      })
    },

    /** Mijoz parol o‘rnatdi: ariza kabinetga bog‘landi */
    attachAccount(id: string, actor: string) {
      const item = this.byId(id)
      if (!item || !item.guest) return
      item.guest = false
      this.log(item, {
        actor,
        roleLabel: 'Ijarachi',
        action: 'Kabinet ochildi',
        detail: `${item.org.name} nomiga hisob yaratildi, ariza kabinetga bog‘landi`,
      })
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

    approveOperation(id: string, actor: string, roleLabel: string, offer: LeaseOffer) {
      const item = this.byId(id)
      if (!item || item.status !== 'YANGI') return
      /* Ijara oqimi faqat ijara so‘rovi uchun: sotuv alohida rasmiylashtiriladi */
      if (item.request.type !== 'Ijaraga olish') return
      this.saveOffer(id, offer)
      item.status = 'OPERATSIYA_TASDIQLADI'
      const totals = scheduleTotals(item.schedule)
      this.log(item, {
        actor,
        roleLabel,
        action: 'Operatsiya tasdiqladi',
        detail: `Oylik ijara ${money(offer.monthlyRent)}, depozit ${money(offer.deposit)}, ${totals.periods} ta to‘lov davri`,
      })
    },

    /**
     * Buxgalter moliyaviy shartlarni tasdiqlaydi, qoralama darhol tuziladi.
     * MOLIYA_TASDIQLADI holati ham qabul qilinadi: qoralama tuzilmay qolgan
     * yozuv shu amal bilan oldinga siljiydi va oqim uzilmaydi.
     */
    approveFinance(id: string, actor: string, roleLabel: string, offer: LeaseOffer) {
      const item = this.byId(id)
      if (!item) return
      if (item.status !== 'OPERATSIYA_TASDIQLADI' && item.status !== 'MOLIYA_TASDIQLADI') return

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
        roleLabel,
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
      if (item.request.type !== 'Ijaraga olish') return

      /*
       * Qayta ishlashdan keyin qoralama qayta tuzilsa, avvalgi kod saqlanadi:
       * bitta ariza bo‘yicha reyestrda ikkita raqam paydo bo‘lmaydi.
       */
      const code =
        item.contract?.code ?? nextContractCode(this.cases.map((c) => c.contract?.code))
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
        tenant: partyOf('Ijarachi', item.org),
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
            value: `${money(item.offer.servicePerSqm)} / m² / oy, jami ${money(service)}`,
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
        /*
         * Grafik nusxa emas, asosiy grafikning o‘zi: davr holati o‘zgarganda
         * shartnoma hujjatidagi jadval ham o‘sha zahoti yangilanadi.
         */
        schedule: item.schedule,
      }

      item.contract = doc
      item.status = 'QORALAMA_TAYYOR'
      this.log(item, {
        actor: 'Tizim',
        roleLabel: 'Avtomatik',
        action: 'Shartnoma qoralamasi tuzildi',
        detail: `${code}: ${item.request.term} oy, ${money(totals.total)} (DOCX)`,
      })
    },

    /** 6-bosqich: hujjat Didox’ga yuboriladi */
    sendToDidox(id: string, actor: string, roleLabel: string) {
      const item = this.byId(id)
      if (!item || !item.contract || item.status !== 'QORALAMA_TAYYOR') return

      this.didoxSequence += 1
      const stamp = now()

      item.didox = {
        docNumber: `DX-${todayIso().slice(0, 4)}-${this.didoxSequence}`,
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
        roleLabel,
        action: 'Didox orqali yuborildi',
        detail: `${item.contract.code} · Didox hujjat raqami ${item.didox.docNumber}`,
      })
    },

    /**
     * 7-bosqich: Didox tomonidagi holat tekshiriladi.
     *
     * Natija qaytariladi, shuning uchun sahifa haqiqatda nima bo‘lganini
     * aytadi: holat o‘zgardimi yoki o‘zgarishsiz qoldimi. Ariza statusi ham
     * har safar ticket holatidan qayta hisoblanadi.
     */
    checkDidox(
      id: string,
      actor: string,
      roleLabel: string,
    ): { changed: boolean; state: DidoxState } | null {
      const item = this.byId(id)
      if (!item || !item.didox) return null
      const ticket = item.didox
      const stamp = now()
      ticket.lastCheckedAt = stamp

      const i = DIDOX_FLOW.indexOf(ticket.state)
      const next = DIDOX_FLOW[i + 1]

      if (!next) {
        this.syncDidoxStatus(item)
        this.log(item, {
          actor,
          roleLabel,
          action: 'Didox holati tekshirildi',
          detail: `${ticket.docNumber}, holat o‘zgarmadi: ${ticket.state}`,
        })
        return { changed: false, state: ticket.state }
      }

      const note =
        next === 'Ko‘rib chiqilmoqda'
          ? `${item.org.name} hujjatni ochdi va ko‘rib chiqmoqda`
          : `Hujjat ikkala tomon tomonidan imzolandi va Didox’da yakunlandi`

      ticket.state = next
      ticket.history.push({ state: next, at: stamp, note })

      this.log(item, {
        actor,
        roleLabel,
        action: 'Didox holati tekshirildi',
        detail: `${ticket.docNumber}, yangi holat: ${next}`,
      })

      this.syncDidoxStatus(item)
      return { changed: true, state: next }
    },

    /** Ariza bosqichi Didox ticketidagi holatga moslashtiriladi */
    syncDidoxStatus(item: LeaseCase) {
      if (!item.didox) return
      if (item.status === 'FAOL' || item.status === 'RAD_ETILDI') return
      if (item.didox.state === 'Imzolangan') item.status = 'DIDOX_IMZOLANDI'
      else if (item.status === 'DIDOX_IMZOLANDI') item.status = 'DIDOX_YUBORILDI'
    },

    /** 8-bosqich: Didox’dan olingan imzolangan fayl tizimga yuklanadi */
    attachSignedDocument(
      id: string,
      actor: string,
      roleLabel: string,
      file: Omit<SignedDocument, 'uploadedAt' | 'uploadedBy'>,
    ) {
      const item = this.byId(id)
      if (!item || item.status !== 'DIDOX_IMZOLANDI') return
      item.signedDocument = { ...file, uploadedAt: now(), uploadedBy: actor }
      this.log(item, {
        actor,
        roleLabel,
        action: 'Imzolangan hujjat yuklandi',
        detail: `${file.fileName} · SHA-256: ${file.hash.slice(0, 16)}…`,
      })
    },

    removeSignedDocument(id: string, actor: string, roleLabel: string) {
      const item = this.byId(id)
      if (!item || !item.signedDocument || item.status === 'FAOL') return
      const name = item.signedDocument.fileName
      item.signedDocument = null
      this.log(item, {
        actor,
        roleLabel,
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

    /**
     * Oldingi bosqichga qaytarish, sabab bilan.
     *
     * MOLIYA_TASDIQLADI oraliq holat: unda hech kimda bosadigan tugma yo‘q,
     * shuning uchun qoralama bosqichi to‘g‘ridan-to‘g‘ri buxgalter qaroriga
     * qaytariladi. Didox bosqichidan qaytarilganda tashqi xizmatdagi hujjat
     * bekor qilinadi, aks holda ariza eski ticket bilan qotib qolar edi.
     */
    returnForRework(id: string, actor: string, roleLabel: string, reason: string) {
      const item = this.byId(id)
      if (!item) return

      const RETURN_TO: Partial<Record<LeaseStatus, LeaseStatus>> = {
        OPERATSIYA_TASDIQLADI: 'YANGI',
        MOLIYA_TASDIQLADI: 'OPERATSIYA_TASDIQLADI',
        QORALAMA_TAYYOR: 'OPERATSIYA_TASDIQLADI',
        DIDOX_YUBORILDI: 'QORALAMA_TAYYOR',
        DIDOX_IMZOLANDI: 'QORALAMA_TAYYOR',
      }

      const cancelled = item.didox
      if (cancelled) item.didox = null
      if (item.signedDocument) item.signedDocument = null

      item.status = RETURN_TO[item.status] ?? 'YANGI'

      this.log(item, {
        actor,
        roleLabel,
        action: 'Qayta ishlashga yuborildi',
        detail: cancelled
          ? `${reason} · Didox hujjati ${cancelled.docNumber} bekor qilindi`
          : reason,
      })
    },

    activate(id: string, actor: string, roleLabel: string) {
      const item = this.byId(id)
      if (!item || !item.contract || !item.offer) return null
      if (item.status !== 'DIDOX_IMZOLANDI' || !item.signedDocument) return null

      const building = buildingById(item.buildingId)
      const totals = scheduleTotals(item.schedule)
      /* Birinchi hisob-faktura grafikning birinchi qatoriga chiqariladi */
      const first = item.schedule[0] ?? null

      const contractId = `c-${item.contract.code.slice(-4)}`
      const invoiceCode = nextInvoiceCode(
        this.cases.flatMap((c) => c.schedule.map((r) => r.invoiceCode)),
      )

      if (first) {
        first.status = 'ISSUED'
        first.invoiceCode = invoiceCode
      }

      const rest = item.schedule.filter((r) => r.status === 'PLANNED').length

      const changes: ActivationChange[] = [
        {
          icon: 'building',
          label: `Unit holati «${UNIT_STATUS.RENTED?.label ?? 'Ijarada'}» ga o‘tdi`,
          detail: `${item.buildingName} · Unit ${item.unitCode}, ${item.org.name} nomiga rasmiylashtirildi`,
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
            ? `${first.label} · ${money(first.total)} · to‘lov muddati ${dmy(first.dueAt)}. Qolgan ${rest} ta davr muddati kelganda chiqariladi`
            : '',
        },
      ]

      item.status = 'FAOL'
      item.activation = { at: now(), invoiceCode, contractId, changes }

      this.log(item, {
        actor,
        roleLabel,
        action: 'Shartnoma faollashtirildi',
        detail: `Unit band qilindi, ${invoiceCode} hisob-fakturasi chiqarildi, qolgan ${rest} ta davr grafik bo‘yicha chiqariladi`,
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

      if (!CONTRACTS.some((c) => c.id === contractId || c.code === doc.code)) {
        /* Bosqichlar reyestr kutgan to‘rt nom bilan yoziladi, sana va mas’ul audit jurnalidan */
        const stageOf = (action: string) => item.audit.find((a) => a.action === action)
        const composed = stageOf('Shartnoma qoralamasi tuzildi')
        const agreed = stageOf('Moliya tasdiqladi')
        const signed = stageOf('Imzolangan hujjat yuklandi')

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
              size: item.signedDocument ? `${Math.round(item.signedDocument.size / 1024)} KB` : '-',
              type: item.signedDocument?.extension === 'pdf' ? 'pdf' : 'docx',
            },
            { name: 'To‘lov jadvali.xlsx', size: '-', type: 'xlsx' },
          ],
          timeline: [
            {
              label: 'Yaratildi',
              date: (composed?.at ?? doc.composedAt).slice(0, 10),
              actor: composed?.actor ?? 'Tizim',
              done: true,
            },
            {
              label: 'Kelishildi',
              date: (agreed?.at ?? doc.composedAt).slice(0, 10),
              actor: agreed?.actor ?? 'Tizim',
              done: true,
            },
            {
              label: 'Imzolandi',
              date: (signed?.at ?? activation.at).slice(0, 10),
              actor: signed?.actor ?? item.didox?.sentBy ?? 'Didox',
              done: true,
            },
            {
              label: 'Faollashdi',
              date: activation.at.slice(0, 10),
              actor: item.audit.find((a) => a.action === 'Shartnoma faollashtirildi')?.actor ?? 'Tizim',
              done: true,
            },
          ],
        })
      }

      this.syncInvoices(item)
    },

    /**
     * Chiqarilgan davrlar billing reyestriga yoziladi. Amal takrorlansa ham
     * bitta kod ikki marta qo‘shilmaydi, shuning uchun sahifa qayta
     * yuklanganda grafik va hisob-fakturalar bir xil qoladi.
     */
    syncInvoices(item: LeaseCase) {
      const activation = item.activation
      if (!activation) return

      for (const row of item.schedule) {
        if (!row.invoiceCode || row.status === 'PLANNED') continue
        if (INVOICES.some((i) => i.code === row.invoiceCode)) continue

        const base = {
          id: `i-${row.invoiceCode.slice(-4)}`,
          code: row.invoiceCode,
          contractCode: item.contract?.code,
          tenant: item.org.name,
          buildingName: item.buildingName,
          unitCode: `Unit ${item.unitCode}`,
          period: row.label,
          issuedAt: activation.at.slice(0, 10),
          dueAt: row.dueAt,
          total: row.total,
          paid: row.status === 'PAID' ? row.total : 0,
          status: 'ISSUED' as Invoice['status'],
        }

        INVOICES.unshift({ ...base, status: statusOf(base), agingBucket: agingKeyOf(base) })
      }
    },

    /**
     * Grafikdagi navbatdagi davr uchun hisob-faktura chiqaradi: faollashtirish
     * paytida birinchi davr, keyingilari muddati kelganda shu amal orqali.
     */
    issueInvoice(id: string, actor: string, roleLabel: string, periodId?: string): string {
      const item = this.byId(id)
      if (!item || item.status !== 'FAOL' || !item.activation) return ''

      const row = periodId
        ? item.schedule.find((r) => r.id === periodId && r.status === 'PLANNED')
        : item.schedule.find((r) => r.status === 'PLANNED')
      if (!row) return ''

      row.invoiceCode = nextInvoiceCode(
        this.cases.flatMap((c) => c.schedule.map((r) => r.invoiceCode)),
      )
      row.status = 'ISSUED'
      this.syncInvoices(item)

      this.log(item, {
        actor,
        roleLabel,
        action: 'Hisob-faktura chiqarildi',
        detail: `${row.invoiceCode} · ${row.label} · ${money(row.total)} · to‘lov muddati ${dmy(row.dueAt)}`,
      })

      return row.invoiceCode
    },

    /** Saqlangan holat qayta tiklangandan keyin reyestrni moslashtiradi */
    syncWorld() {
      this.seed()
      for (const item of this.cases) {
        // Eskiroq saqlangan yozuvlarda yangi maydonlar bo‘lmasligi mumkin.
        if (typeof item.guest !== 'boolean') item.guest = false
        if (typeof item.contactName !== 'string' || !item.contactName) {
          item.contactName = item.org.director
        }
        if (item.accountInvitedAt === undefined) item.accountInvitedAt = null

        /*
         * Saqlangan holatda hujjat grafigi alohida massiv bo‘lib tiklanadi.
         * Havola qayta bog‘lanadi, aks holda shartnoma hujjatidagi davr
         * holati ariza sahifasidagi holatdan orqada qolib ketadi.
         */
        if (item.contract) item.contract.schedule = item.schedule

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
