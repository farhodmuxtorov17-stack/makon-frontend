import { reactive } from 'vue'
import { UNITS, unitById, type Unit } from './units'
import { monthTitle, todayIso } from '~/utils/format'

/**
 * Shartnoma reyestri unit reyestriga tayanadi: `units.ts` dagi har bir band
 * unitning `contractCode` i shu yerdagi bitta yozuvga ishora qiladi va aksincha.
 * Nomlangan shartnomalar qo‘lda yozilgan (ular hujjat, ariza va bildirishnoma
 * ekranlarida kod bo‘yicha qidiriladi), qolganlari reyestrdan hosil qilinadi.
 *
 * Qoidalar:
 *  - bitta kod: bitta unit, bitta ijarachi;
 *  - unit `RENTED` bo‘lsa shartnoma `ACTIVE` va turi «Ijara»;
 *  - unit `SOLD` bo‘lsa shartnoma turi «Sotuv»;
 *  - `DRAFT`/`REVIEW` shartnoma unitni band qilmaydi, u faqat rezervda turadi
 *    va bunday shartnoma bo‘yicha hisob-faktura chiqarilmaydi;
 *  - muddati o‘tgan shartnoma `EXPIRED`, uniti esa bo‘sh bo‘ladi.
 */
export interface Contract {
  id: string
  code: string
  type: 'Ijara' | 'Sotuv'
  tenant: string
  buildingId: string
  buildingName: string
  unitCode: string
  startsAt: string
  /** Sotuv shartnomasida muddat bo‘lmaydi, qiymat «-» */
  endsAt: string
  status: 'DRAFT' | 'REVIEW' | 'SIGNED' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
  /** Ijarada yillik summa (oylik × 12), sotuvda to‘liq qiymat (m² narxi × maydon) */
  amount: number
  paymentTerm: string
  documents: Array<{ name: string; size: string; type: 'pdf' | 'xlsx' | 'docx' }>
  timeline: Array<{ label: string; date: string; actor: string; done: boolean }>
}

const TODAY = todayIso()

/**
 * Bino nomlari shu yerda saqlanadi: bino reyestri o‘z jamlarini hisob-faktura
 * va unit reyestridan oladi, teskari import esa aylanma bog‘lanish hosil qiladi.
 */
const BUILDING_NAMES: Record<string, string> = {
  'b-01': 'Green Business Center',
  'b-02': 'Mega Mall',
  'b-03': 'Industrial Park 2',
  'b-04': 'Harmony Residence',
  'b-05': 'Urban Office',
  'b-06': 'Chorsu Savdo Galereyasi',
  'b-07': 'Yunusobod Tower',
  'b-08': 'Salar Logistika Markazi',
  'b-09': 'Chilonzor Plaza',
  'b-10': 'Nurafshon Residence',
  'b-11': 'Sergeli Logistik Terminal',
  'b-12': 'Olmazor Business Hub',
  'b-13': 'Uchtepa Savdo Markazi',
  'b-14': 'Bektemir Sanoat Ombori',
  'b-15': 'Mirobod Office Park',
  'b-16': 'Yakkasaroy Atrium',
  'b-17': 'Zangiota Logistics Park',
  'b-18': 'Qibray Business Park',
  'b-19': 'Yashnobod Residence',
  'b-20': 'Shayxontohur Ofis Markazi',
  'b-21': 'Sergeli City Mall',
  'b-22': 'Bog‘ishamol Residence',
}

// --- sana yordamchilari ----------------------------------------------------

function isoOf(date: Date): string {
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoOf(d)
}

function shiftMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return isoOf(d)
}

/** Ikki sana orasidagi kunlar farqi; `to` kechroq bo‘lsa musbat */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime()
  const b = new Date(`${to}T00:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

/** Unit id sidan barqaror son: generatsiya har safar bir xil natija beradi */
function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

// --- nomlangan shartnomalar ------------------------------------------------

const NAMED_CONTRACTS: Contract[] = [
  {
    id: 'c-0161',
    code: 'MKON-2025-0161',
    type: 'Ijara',
    tenant: 'Urban Office MCHJ',
    buildingId: 'b-01',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 501',
    startsAt: '2025-04-02',
    endsAt: '2027-04-01',
    status: 'ACTIVE',
    amount: 310800000,
    paymentTerm: 'Oylik oldindan to‘lov',
    documents: [
      { name: 'Ijara shartnomasi.pdf', size: '2.1 MB', type: 'pdf' },
      { name: 'Jihozlar ro‘yxati dalolatnomasi.docx', size: '460 KB', type: 'docx' },
    ],
    timeline: [
      { label: 'Yaratildi', date: '2025-03-20', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2025-03-26', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-03-31', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-04-02', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0158',
    code: 'MKON-2025-0158',
    type: 'Ijara',
    tenant: 'Urban Office MCHJ',
    buildingId: 'b-01',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 502',
    startsAt: '2025-05-18',
    endsAt: '2027-05-17',
    status: 'ACTIVE',
    amount: 150480000,
    paymentTerm: 'Oylik oldindan to‘lov',
    documents: [
      { name: 'Ijara shartnomasi.pdf', size: '2.4 MB', type: 'pdf' },
      { name: 'Qabul-topshirish akti.pdf', size: '1.1 MB', type: 'pdf' },
      { name: 'To‘lov jadvali.xlsx', size: '340 KB', type: 'xlsx' },
    ],
    timeline: [
      { label: 'Yaratildi', date: '2025-05-08', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2025-05-12', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-05-16', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-05-18', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0165',
    code: 'MKON-2025-0165',
    type: 'Sotuv',
    tenant: '«Grand Trade» MCHJ',
    buildingId: 'b-01',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 708',
    startsAt: '2025-06-02',
    endsAt: '-',
    status: 'ACTIVE',
    amount: 2876676000,
    paymentTerm: 'Bir martalik to‘lov',
    documents: [
      { name: 'Oldi-sotdi shartnomasi.pdf', size: '2.6 MB', type: 'pdf' },
      { name: 'Qabul-topshirish akti.pdf', size: '1.2 MB', type: 'pdf' },
    ],
    timeline: [
      { label: 'Yaratildi', date: '2025-05-14', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2025-05-22', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-05-30', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-06-02', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0157',
    code: 'MKON-2025-0157',
    type: 'Ijara',
    tenant: 'Tech Solutions UZB MChJ',
    buildingId: 'b-01',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 701',
    startsAt: '2025-04-01',
    endsAt: '2027-03-31',
    status: 'ACTIVE',
    amount: 182400000,
    paymentTerm: 'Oylik oldindan to‘lov',
    documents: [
      { name: 'Ijara shartnomasi.pdf', size: '2.1 MB', type: 'pdf' },
      { name: 'To‘lov jadvali.xlsx', size: '298 KB', type: 'xlsx' },
    ],
    timeline: [
      { label: 'Yaratildi', date: '2025-03-18', actor: 'Dilshod Karimov', done: true },
      { label: 'Kelishildi', date: '2025-03-24', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-03-29', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-04-01', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0156',
    code: 'MKON-2025-0156',
    type: 'Sotuv',
    tenant: 'Mega Invest Group',
    buildingId: 'b-03',
    buildingName: 'Industrial Park 2',
    unitCode: 'Unit B-12',
    startsAt: '2026-09-15',
    endsAt: '-',
    status: 'DRAFT',
    amount: 2452500000,
    paymentTerm: 'Bir martalik to‘lov',
    documents: [{ name: 'Sotuv shartnomasi loyihasi.pdf', size: '1.8 MB', type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2026-08-05', actor: 'Bobur Ismoilov', done: true },
      { label: 'Kelishildi', date: '-', actor: '-', done: false },
      { label: 'Imzolandi', date: '-', actor: '-', done: false },
      { label: 'Faollashdi', date: '-', actor: '-', done: false },
    ],
  },
  {
    id: 'c-0155',
    code: 'MKON-2025-0155',
    type: 'Ijara',
    tenant: 'Global Logistics & Trans',
    buildingId: 'b-04',
    buildingName: 'Harmony Residence',
    unitCode: 'Unit A-502',
    startsAt: '2026-09-01',
    endsAt: '2027-08-31',
    status: 'REVIEW',
    amount: 89760000,
    paymentTerm: 'Choraklik to‘lov',
    documents: [{ name: 'Shartnoma loyihasi.pdf', size: '1.6 MB', type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2026-08-04', actor: 'Nigora Aripova', done: true },
      { label: 'Kelishildi', date: '2026-08-11', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '-', actor: '-', done: false },
      { label: 'Faollashdi', date: '-', actor: '-', done: false },
    ],
  },
  {
    id: 'c-0154',
    code: 'MKON-2025-0154',
    type: 'Ijara',
    tenant: 'FinTech Services',
    buildingId: 'b-01',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 703',
    startsAt: '2023-05-01',
    endsAt: '2025-04-30',
    status: 'EXPIRED',
    amount: 235200000,
    paymentTerm: 'Oylik oldindan to‘lov',
    documents: [{ name: 'Ijara shartnomasi.pdf', size: '2.0 MB', type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2023-04-12', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2023-04-18', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2023-04-26', actor: 'Jahongir Alimov', done: true },
      { label: 'Muddati tugadi', date: '2025-04-30', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0152',
    code: 'MKON-2025-0152',
    type: 'Ijara',
    tenant: 'Dream Retail',
    buildingId: 'b-02',
    buildingName: 'Mega Mall',
    unitCode: 'Unit 204',
    startsAt: '2025-02-01',
    endsAt: '2028-01-31',
    status: 'ACTIVE',
    amount: 94800000,
    paymentTerm: 'Oylik oldindan to‘lov',
    documents: [{ name: 'Ijara shartnomasi.pdf', size: '2.2 MB', type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2025-01-14', actor: 'Dilshod Karimov', done: true },
      { label: 'Kelishildi', date: '2025-01-20', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-01-27', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-02-01', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0149',
    code: 'MKON-2025-0149',
    type: 'Ijara',
    tenant: 'Creative Agency',
    buildingId: 'b-01',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 705',
    startsAt: '2025-03-01',
    endsAt: '2027-02-28',
    status: 'ACTIVE',
    amount: 201600000,
    paymentTerm: 'Oylik oldindan to‘lov',
    documents: [
      { name: 'Ijara shartnomasi.pdf', size: '1.9 MB', type: 'pdf' },
      { name: 'Qo‘shimcha kelishuv.pdf', size: '640 KB', type: 'pdf' },
    ],
    timeline: [
      { label: 'Yaratildi', date: '2025-02-10', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2025-02-16', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-02-24', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-03-01', actor: 'Tizim', done: true },
      { label: 'Uzaytirildi', date: '2026-02-20', actor: 'Nilufar Rahimova', done: true },
    ],
  },
  {
    id: 'c-0124',
    code: 'MKON-2025-0124',
    type: 'Ijara',
    tenant: 'Global Logistics & Trans',
    buildingId: 'b-01',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 503',
    startsAt: '2025-02-01',
    endsAt: '2027-01-31',
    status: 'ACTIVE',
    amount: 208800000,
    paymentTerm: 'Oylik oldindan to‘lov',
    documents: [
      { name: 'Ijara shartnomasi.pdf', size: '2.0 MB', type: 'pdf' },
      { name: 'To‘lov jadvali.xlsx', size: '310 KB', type: 'xlsx' },
    ],
    timeline: [
      { label: 'Yaratildi', date: '2025-01-13', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2025-01-20', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-01-28', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-02-01', actor: 'Tizim', done: true },
    ],
  },
]

// --- reyestrdan hosil qilinadigan shartnomalar -----------------------------

const RENT_TERMS = [12, 24, 36]

/** Band unit uchun shartnoma yozuvi: sana, summa va bosqichlar unitdan chiqadi */
function contractOf(unit: Unit): Contract {
  const seed = seedOf(unit.id)
  const sale = unit.offer === 'Sotuv'
  const age = 45 + (seed % 640)
  const startsAt = shiftDays(TODAY, -age)
  // Muddat shartnoma yoshiga qarab tanlanadi, tugash sanasi doim kelajakda
  const term = RENT_TERMS[age > 500 ? 2 : age > 260 ? 1 : 0]!
  const quarterly = seed % 7 === 0
  return {
    id: `c-${unit.contractCode!.slice(-4)}`,
    code: unit.contractCode!,
    type: sale ? 'Sotuv' : 'Ijara',
    tenant: unit.tenant!,
    buildingId: unit.buildingId,
    buildingName: BUILDING_NAMES[unit.buildingId] ?? unit.buildingId,
    unitCode: `Unit ${unit.code}`,
    startsAt,
    endsAt: sale ? '-' : shiftDays(shiftMonths(startsAt, term), -1),
    status: 'ACTIVE',
    amount: sale ? Math.round(unit.price * unit.area) : unit.price * 12,
    paymentTerm: sale
      ? 'Bir martalik to‘lov'
      : quarterly
        ? 'Choraklik to‘lov'
        : 'Oylik oldindan to‘lov',
    documents: sale
      ? [
          { name: 'Oldi-sotdi shartnomasi.pdf', size: '2.3 MB', type: 'pdf' },
          { name: 'Qabul-topshirish akti.pdf', size: '1.1 MB', type: 'pdf' },
        ]
      : [
          { name: 'Ijara shartnomasi.pdf', size: '2.0 MB', type: 'pdf' },
          { name: 'To‘lov jadvali.xlsx', size: '312 KB', type: 'xlsx' },
        ],
    timeline: [
      { label: 'Yaratildi', date: shiftDays(startsAt, -12), actor: 'Nilufar Rahimova', done: true },
      { label: 'Kelishildi', date: shiftDays(startsAt, -7), actor: 'Jahongir Alimov', done: true },
      { label: 'Imzolandi', date: shiftDays(startsAt, -2), actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: startsAt, actor: 'Tizim', done: true },
    ],
  }
}

/**
 * Reyestr: qo‘lda yozilgan yozuvlar + har bir band unit uchun hosil qilingani.
 * Shu sababli unit kartochkasidan nusxalangan kod har doim shu ro‘yxatda
 * topiladi va aynan o‘sha bino, o‘sha ijarachini ko‘rsatadi.
 */
function buildRegistry(): Contract[] {
  const named = new Set(NAMED_CONTRACTS.map((c) => c.code))
  const derived: Contract[] = []
  for (const unit of UNITS) {
    if (!unit.contractCode || named.has(unit.contractCode)) continue
    if (unit.status !== 'RENTED' && unit.status !== 'SOLD') continue
    derived.push(contractOf(unit))
  }
  derived.sort((a, b) => (a.code < b.code ? 1 : -1))
  return [...NAMED_CONTRACTS, ...derived]
}

export const CONTRACTS: Contract[] = reactive(buildRegistry())

export function contractByCode(code: string): Contract | undefined {
  return CONTRACTS.find((c) => c.code === code)
}

/** Unitning amaldagi shartnomasi */
export function contractOfUnit(unitId: string): Contract | undefined {
  const unit = unitById(unitId)
  return unit?.contractCode ? contractByCode(unit.contractCode) : undefined
}

/**
 * Reyestr izchilligini tekshiradi: kod takrorlanmasin, har bir kod bitta
 * unitga tegishli bo‘lsin, shartnoma turi va holati unit holatiga mos kelsin.
 * Bo‘sh massiv qaytsa reyestr toza.
 */
export function registryIssues(): string[] {
  const issues: string[] = []
  const byCode = new Map<string, string[]>()
  for (const u of UNITS) {
    if (!u.contractCode) continue
    byCode.set(u.contractCode, [...(byCode.get(u.contractCode) ?? []), u.id])
  }
  for (const [code, list] of byCode) {
    if (list.length > 1) issues.push(`${code}: ${list.length} ta unitda (${list.join(', ')})`)
    const contract = CONTRACTS.find((c) => c.code === code)
    if (!contract) {
      issues.push(`${code}: reyestrda yo‘q`)
      continue
    }
    const unit = unitById(list[0]!)!
    if (unit.tenant !== contract.tenant) issues.push(`${code}: ijarachi mos emas`)
    if (unit.buildingId !== contract.buildingId) issues.push(`${code}: bino mos emas`)
    if (contract.unitCode !== `Unit ${unit.code}`) issues.push(`${code}: unit raqami mos emas`)
    if (unit.status === 'RENTED' && contract.type !== 'Ijara') issues.push(`${code}: tur mos emas`)
    if (unit.status === 'SOLD' && contract.type !== 'Sotuv') issues.push(`${code}: tur mos emas`)
    if (unit.status === 'RENTED' && contract.status !== 'ACTIVE')
      issues.push(`${code}: band unit, lekin shartnoma ${contract.status}`)
  }
  const codes = new Set<string>()
  for (const c of CONTRACTS) {
    if (codes.has(c.code)) issues.push(`${c.code}: reyestrda takrorlanadi`)
    codes.add(c.code)
    if (c.status === 'ACTIVE' && c.endsAt !== '-' && c.endsAt < TODAY)
      issues.push(`${c.code}: muddati o‘tgan, lekin ACTIVE`)
  }
  return issues
}

// ---------------------------------------------------------------------------

export interface Invoice {
  id: string
  code: string
  /** Hisob-faktura faqat mavjud shartnoma asosida chiqariladi */
  contractCode?: string
  tenant: string
  buildingName: string
  unitCode: string
  period: string
  issuedAt: string
  dueAt: string
  total: number
  paid: number
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  /** `dueAt` va joriy sanadan hisoblanadi, qo‘lda yozilmaydi */
  agingBucket: '0-30' | '31-60' | '61-90' | '90+' | null
}

export type AgingKey = '0-30' | '31-60' | '61-90' | '90+'

/** To‘lov muddatidan o‘tgan kunlar; muddati kelmagan hujjatda 0 */
export function overdueDaysOf(invoice: Pick<Invoice, 'dueAt'>): number {
  return Math.max(0, daysBetween(invoice.dueAt, TODAY))
}

/** Qoldiqning muddat guruhi: to‘liq to‘langan hujjatda `null` */
export function agingKeyOf(invoice: Pick<Invoice, 'dueAt' | 'total' | 'paid'>): AgingKey | null {
  if (invoice.total - invoice.paid <= 0) return null
  const days = overdueDaysOf(invoice)
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

/**
 * To‘lov holati qoldiq va muddatdan kelib chiqadi: muddati o‘tgan to‘lanmagan
 * hujjat avtomatik «Kechikkan» bo‘ladi, qo‘lda qo‘yilgan qoralama va bekor
 * qilingan holat esa saqlanadi.
 */
export function statusOf(
  invoice: Pick<Invoice, 'dueAt' | 'total' | 'paid' | 'status'>,
): Invoice['status'] {
  if (invoice.status === 'DRAFT' || invoice.status === 'CANCELLED') return invoice.status
  if (invoice.paid >= invoice.total) return 'PAID'
  if (invoice.dueAt < TODAY) return 'OVERDUE'
  return invoice.paid > 0 ? 'PARTIALLY_PAID' : 'ISSUED'
}

type InvoiceSeed = Omit<Invoice, 'status' | 'agingBucket'> & { status?: Invoice['status'] }

/** Reyestr yozuvi: holat va muddat guruhi hujjat sanalaridan hisoblanadi */
function invoiceOf(seed: InvoiceSeed): Invoice {
  const base = { ...seed, status: seed.status ?? 'ISSUED' }
  return { ...base, status: statusOf(base), agingBucket: agingKeyOf(base) }
}

const INVOICE_SEEDS: InvoiceSeed[] = [
  {
    id: 'i-0817',
    code: 'INV-2026-0817',
    contractCode: 'MKON-2025-0124',
    tenant: 'Global Logistics & Trans',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 503',
    period: 'Avgust 2026',
    issuedAt: '2026-08-01',
    dueAt: '2026-08-25',
    total: 17400000,
    paid: 8000000,
  },
  {
    id: 'i-0816',
    code: 'INV-2026-0816',
    contractCode: 'MKON-2025-0152',
    tenant: 'Dream Retail',
    buildingName: 'Mega Mall',
    unitCode: 'Unit 204',
    period: 'Avgust 2026',
    issuedAt: '2026-08-01',
    dueAt: '2026-08-10',
    total: 7900000,
    paid: 7900000,
  },
  {
    id: 'i-0815',
    code: 'INV-2026-0815',
    contractCode: 'MKON-2025-0149',
    tenant: 'Creative Agency',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 705',
    period: 'Avgust 2026',
    issuedAt: '2026-08-01',
    dueAt: '2026-08-10',
    total: 16800000,
    paid: 0,
  },
  {
    id: 'i-0814',
    code: 'INV-2026-0814',
    contractCode: 'MKON-2025-0157',
    tenant: 'Tech Solutions UZB MChJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 701',
    period: 'Avgust 2026',
    issuedAt: '2026-08-01',
    dueAt: '2026-08-10',
    total: 15200000,
    paid: 15200000,
  },
  {
    id: 'i-0813',
    code: 'INV-2026-0813',
    contractCode: 'MKON-2025-0158',
    tenant: 'Urban Office MCHJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 502',
    period: 'Avgust 2026',
    issuedAt: '2026-08-01',
    dueAt: '2026-08-25',
    total: 12540000,
    paid: 0,
  },
  {
    id: 'i-0812',
    code: 'INV-2026-0812',
    contractCode: 'MKON-2025-0161',
    tenant: 'Urban Office MCHJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 501',
    period: 'Avgust 2026',
    issuedAt: '2026-08-01',
    dueAt: '2026-08-25',
    total: 25900000,
    paid: 12000000,
  },
  {
    id: 'i-0717',
    code: 'INV-2026-0717',
    contractCode: 'MKON-2025-0157',
    tenant: 'Tech Solutions UZB MChJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 701',
    period: 'Iyul 2026',
    issuedAt: '2026-07-01',
    dueAt: '2026-07-10',
    total: 15200000,
    paid: 0,
  },
  {
    id: 'i-0716',
    code: 'INV-2026-0716',
    contractCode: 'MKON-2025-0158',
    tenant: 'Urban Office MCHJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 502',
    period: 'Iyul 2026',
    issuedAt: '2026-07-01',
    dueAt: '2026-07-25',
    total: 12540000,
    paid: 12540000,
  },
  {
    id: 'i-0715',
    code: 'INV-2026-0715',
    contractCode: 'MKON-2025-0161',
    tenant: 'Urban Office MCHJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 501',
    period: 'Iyul 2026',
    issuedAt: '2026-07-01',
    dueAt: '2026-07-10',
    total: 25900000,
    paid: 25900000,
  },
  {
    id: 'i-0621',
    code: 'INV-2026-0621',
    contractCode: 'MKON-2025-0158',
    tenant: 'Urban Office MCHJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 502',
    period: 'Iyun 2026',
    issuedAt: '2026-06-01',
    dueAt: '2026-06-25',
    total: 12540000,
    paid: 0,
  },
  {
    id: 'i-0620',
    code: 'INV-2026-0620',
    contractCode: 'MKON-2025-0161',
    tenant: 'Urban Office MCHJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 501',
    period: 'Iyun 2026',
    issuedAt: '2026-06-01',
    dueAt: '2026-06-10',
    total: 25900000,
    paid: 25900000,
  },
  {
    id: 'i-0587',
    code: 'INV-2025-0587',
    contractCode: 'MKON-2025-0158',
    tenant: 'Urban Office MCHJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 502',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-10',
    total: 12540000,
    paid: 12540000,
  },
  {
    id: 'i-0586',
    code: 'INV-2025-0586',
    contractCode: 'MKON-2025-0157',
    tenant: 'Tech Solutions UZB MChJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 701',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-10',
    total: 15200000,
    paid: 5200000,
  },
  {
    id: 'i-0585',
    code: 'INV-2025-0585',
    contractCode: 'MKON-2025-0149',
    tenant: 'Creative Agency',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 705',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-25',
    total: 16800000,
    paid: 0,
  },
  {
    id: 'i-0584',
    code: 'INV-2025-0584',
    contractCode: 'MKON-2025-0152',
    tenant: 'Dream Retail',
    buildingName: 'Mega Mall',
    unitCode: 'Unit 204',
    period: 'Mart 2025',
    issuedAt: '2025-03-01',
    dueAt: '2025-03-10',
    total: 7900000,
    paid: 0,
  },
  {
    id: 'i-0583',
    code: 'INV-2025-0583',
    contractCode: 'MKON-2025-0124',
    tenant: 'Global Logistics & Trans',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 503',
    period: 'Aprel 2025',
    issuedAt: '2025-04-01',
    dueAt: '2025-04-10',
    total: 17400000,
    paid: 4000000,
  },
  {
    id: 'i-0582',
    code: 'INV-2025-0582',
    contractCode: 'MKON-2025-0154',
    tenant: 'FinTech Services',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 703',
    period: 'Fevral 2025',
    issuedAt: '2025-02-01',
    dueAt: '2025-02-10',
    total: 19600000,
    paid: 0,
  },
  {
    id: 'i-0580',
    code: 'INV-2025-0580',
    contractCode: 'MKON-2025-0161',
    tenant: 'Urban Office MCHJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 501',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-10',
    total: 25900000,
    paid: 25900000,
  },
]

export const INVOICES: Invoice[] = reactive(INVOICE_SEEDS.map(invoiceOf))

/** Joriy hisob davri yorlig‘i, masalan «Avgust 2026» */
export const CURRENT_PERIOD = monthTitle(TODAY)

// ---------------------------------------------------------------------------
// Moliyaviy jamlar: hammasi hisob-faktura reyestridan hisoblanadi.
//
// Reyestr, to‘lovlar va qarzdorlik ekranlari shu funksiyalarni chaqiradi,
// shuning uchun uchala sahifa bir xil raqamni ko‘rsatadi va to‘lov qabul
// qilingan zahoti jamlar yangilanadi.

/**
 * Moliyaviy jamga kiradigan hujjatlar. Bekor qilingan hujjat hisobdan
 * chiqadi, qolganlari (qoralamaga qaytarilgani ham) qoladi: ijarachining
 * qarzi hujjat qaytarilgani uchun yo‘qolmaydi.
 */
export function settledInvoices(list: Invoice[] = INVOICES) {
  return list.filter((i) => i.status !== 'CANCELLED')
}

export interface BillingSummary {
  /** Hisoblangan jami summa, QQS bilan */
  charged: number
  /** Summaga kiritilgan QQS, 12% */
  vat: number
  /** QQS siz summa */
  net: number
  paidTotal: number
  debtTotal: number
  overdueTotal: number
  count: number
  paidCount: number
}

export function billingSummaryOf(list: Invoice[] = INVOICES): BillingSummary {
  const live = settledInvoices(list)
  const charged = live.reduce((s, i) => s + i.total, 0)
  const vat = Math.round(charged - charged / 1.12)
  return {
    charged,
    vat,
    net: charged - vat,
    paidTotal: live.reduce((s, i) => s + i.paid, 0),
    debtTotal: live.reduce((s, i) => s + Math.max(0, i.total - i.paid), 0),
    overdueTotal: live
      .filter((i) => statusOf(i) === 'OVERDUE')
      .reduce((s, i) => s + Math.max(0, i.total - i.paid), 0),
    count: live.length,
    paidCount: live.filter((i) => i.paid >= i.total).length,
  }
}

export interface AgingRow {
  key: AgingKey
  bucket: string
  share: number
  amount: number
  tone: 'ok' | 'brand' | 'warn' | 'danger'
}

export const AGING_BUCKETS: Array<Pick<AgingRow, 'key' | 'bucket' | 'tone'>> = [
  { key: '0-30', bucket: '0–30 kun', tone: 'ok' },
  { key: '31-60', bucket: '31–60 kun', tone: 'brand' },
  { key: '61-90', bucket: '61–90 kun', tone: 'warn' },
  { key: '90+', bucket: '90+ kun', tone: 'danger' },
]

/** Muddat guruhining ekranda ko‘rinadigan yorlig‘i */
export function agingLabel(key: AgingKey | null): string {
  return AGING_BUCKETS.find((b) => b.key === key)?.bucket ?? 'Qarzdorlik yo‘q'
}

/** Qarzdorlikning muddat guruhlari bo‘yicha taqsimoti */
export function agingOf(list: Invoice[] = INVOICES): AgingRow[] {
  const open = settledInvoices(list).filter((i) => i.total - i.paid > 0)
  const total = open.reduce((s, i) => s + (i.total - i.paid), 0)
  return AGING_BUCKETS.map((b) => {
    const amount = open
      .filter((i) => agingKeyOf(i) === b.key)
      .reduce((s, i) => s + (i.total - i.paid), 0)
    return { ...b, amount, share: total ? Math.round((amount / total) * 100) : 0 }
  })
}

export interface PaymentStatusRow {
  label: string
  status: Invoice['status']
  count: number
  share: number
  amount: number
  tone: 'ok' | 'brand' | 'warn' | 'danger'
}

const PAYMENT_STATUS_ROWS: Array<Pick<PaymentStatusRow, 'label' | 'status' | 'tone'>> = [
  { label: 'To‘langan', status: 'PAID', tone: 'ok' },
  { label: 'Qisman to‘langan', status: 'PARTIALLY_PAID', tone: 'warn' },
  { label: 'Tasdiqlangan', status: 'ISSUED', tone: 'brand' },
  { label: 'Kechikkan', status: 'OVERDUE', tone: 'danger' },
]

/** Hisob-fakturalarning to‘lov holati kesimi */
export function paymentStatusOf(list: Invoice[] = INVOICES): PaymentStatusRow[] {
  const live = settledInvoices(list)
  return PAYMENT_STATUS_ROWS.map((row) => {
    const rows = live.filter((i) => i.status === row.status)
    return {
      ...row,
      count: rows.length,
      share: live.length ? Math.round((rows.length / live.length) * 100) : 0,
      amount: rows.reduce((s, i) => s + i.total, 0),
    }
  })
}

/**
 * Sahifa ochilganda hisoblanadigan muddat guruhlari. Jonli qiymat kerak
 * bo‘lganda `agingOf()` computed ichida chaqiriladi.
 */
export const AGING = agingOf()

// ---------------------------------------------------------------------------
// Kommunal tariflar
//
// Hisoblagichli xizmatlarning miqdori qo‘lda yozilmaydi: u hisoblagich
// ko‘rsatkichlari farqidan olinadi. Hisoblagichlar reyestri operatsion
// ma’lumotlar faylida turadi va o‘zi shu fayldan hisob-fakturalarni o‘qiydi,
// shuning uchun ro‘yxat parametr sifatida uzatiladi: ikki tomonlama import
// aylanma bog‘lanish hosil qilardi.

/** Tarif jadvaliga miqdor beradigan hisoblagich ko‘rsatkichi */
export interface MeterReading {
  code: string
  type: string
  buildingName: string
  lastReading: number
  previousReading: number
}

/** Hisoblagichning oxirgi davrdagi sarfi: oxirgi ko‘rsatkich − oldingisi */
export function meterUsageOf(reading: Pick<MeterReading, 'lastReading' | 'previousReading'>): number {
  return Math.max(0, Math.round((reading.lastReading - reading.previousReading) * 100) / 100)
}

export interface TariffLine {
  service: string
  unit: string
  tariff: number
  qty: number
  sum: number
  /** Miqdor qaysi hisoblagichdan olingani; maydonga bog‘liq xizmatda bo‘sh */
  meter: string
}

const METERED_SERVICES = [
  { service: 'Elektr energiyasi', unit: 'kVt-soat', tariff: 1250, type: 'Elektr' },
  { service: 'Suv ta’minoti', unit: 'm³', tariff: 9000, type: 'Suv' },
  { service: 'Issiqlik ta’minoti', unit: 'Gkal', tariff: 160000, type: 'Issiqlik' },
]

const AREA_SERVICES = [
  { service: 'Boshqaruv xizmati', tariff: 3000 },
  { service: 'Tozalash xizmati', tariff: 2000 },
]

/** Maydonga bog‘liq xizmatlar: miqdor unitning m² qiymatiga teng */
export function serviceLinesFor(area: number): TariffLine[] {
  return AREA_SERVICES.map((row) => ({
    service: row.service,
    unit: 'm²',
    tariff: row.tariff,
    qty: area,
    sum: Math.round(row.tariff * area),
    meter: '',
  }))
}

/**
 * Ijarachiga beriladigan kommunal qatorlar: hisoblagichli xizmatlar sarfdan,
 * qolganlari maydondan hisoblanadi, summa esa doim `tarif × miqdor` ga teng.
 * Binoda tegishli hisoblagich bo‘lmasa, qator umuman chiqmaydi: jadval
 * hisoblagich ekranidagi ko‘rsatkich bilan bir xil raqamni beradi.
 */
export function tariffLinesFor(
  readings: MeterReading[],
  buildingName: string,
  area: number,
): TariffLine[] {
  const lines: TariffLine[] = []
  for (const row of METERED_SERVICES) {
    const meter = readings.find((m) => m.buildingName === buildingName && m.type === row.type)
    if (!meter) continue
    const qty = meterUsageOf(meter)
    lines.push({
      service: row.service,
      unit: row.unit,
      tariff: row.tariff,
      qty,
      sum: Math.round(row.tariff * qty),
      meter: meter.code,
    })
  }
  return [...lines, ...serviceLinesFor(area)]
}

/**
 * Standart xizmat qatorlari: namuna sifatida Green Business Center 501-uniti.
 * Hisoblagichli qatorlar bu ro‘yxatga kirmaydi: ular uchun `tariffLinesFor()`
 * ni hisoblagichlar ro‘yxati bilan chaqirish kerak.
 */
export const TARIFF_LINES: TariffLine[] = serviceLinesFor(unitById('u-501')?.area ?? 0)
