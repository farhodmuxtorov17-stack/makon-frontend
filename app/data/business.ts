import { reactive } from 'vue'

export interface Contract {
  id: string
  code: string
  type: 'Ijara' | 'Sotuv'
  tenant: string
  buildingId: string
  buildingName: string
  unitCode: string
  startsAt: string
  endsAt: string
  status: 'DRAFT' | 'REVIEW' | 'SIGNED' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
  amount: number
  paymentTerm: string
  documents: Array<{ name: string; size: string; type: 'pdf' | 'xlsx' | 'docx' }>
  timeline: Array<{ label: string; date: string; actor: string; done: boolean }>
}

export const CONTRACTS: Contract[] = reactive([
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
    tenant: 'Urban Office LLC',
    buildingId: 'b-01',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 708',
    startsAt: '2025-05-18',
    endsAt: '2027-05-17',
    status: 'ACTIVE',
    amount: 125400000,
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
    id: 'c-0157',
    code: 'MKON-2025-0157',
    type: 'Ijara',
    tenant: 'Tech Solutions UZB MChJ',
    buildingId: 'b-02',
    buildingName: 'Mega Mall',
    unitCode: 'Unit 204',
    startsAt: '2025-04-01',
    endsAt: '2027-03-31',
    status: 'ACTIVE',
    amount: 67200000,
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
    startsAt: '2025-06-01',
    endsAt: '-',
    status: 'DRAFT',
    amount: 2450000000,
    paymentTerm: 'Bir martalik to‘lov',
    documents: [{ name: 'Sotuv shartnomasi loyihasi.pdf', size: '1.8 MB', type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2025-05-14', actor: 'Bobur Ismoilov', done: true },
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
    startsAt: '2025-05-25',
    endsAt: '2026-05-24',
    status: 'REVIEW',
    amount: 89760000,
    paymentTerm: 'Choraklik to‘lov',
    documents: [{ name: 'Shartnoma loyihasi.pdf', size: '1.6 MB', type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2025-05-11', actor: 'Nigora Aripova', done: true },
      { label: 'Kelishildi', date: '2025-05-15', actor: 'Nilufar Rahimova', done: true },
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
    amount: 54000000,
    paymentTerm: 'Oylik oldindan to‘lov',
    documents: [{ name: 'Ijara shartnomasi.pdf', size: '2.0 MB', type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2023-04-12', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2023-04-18', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2023-04-26', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2023-05-01', actor: 'Tizim', done: true },
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
    endsAt: '2026-02-28',
    status: 'ACTIVE',
    amount: 63600000,
    paymentTerm: 'Oylik oldindan to‘lov',
    documents: [{ name: 'Ijara shartnomasi.pdf', size: '1.9 MB', type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2025-02-10', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2025-02-16', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-02-24', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-03-01', actor: 'Tizim', done: true },
    ],
  },
])

// ---------------------------------------------------------------------------

export interface Invoice {
  id: string
  code: string
  tenant: string
  buildingName: string
  unitCode: string
  period: string
  issuedAt: string
  dueAt: string
  total: number
  paid: number
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  agingBucket: '0-30' | '31-60' | '61-90' | '90+' | null
}

export const INVOICES: Invoice[] = reactive([
  {
    id: 'i-0587',
    code: 'INV-2025-0587',
    tenant: 'Urban Office LLC',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 502',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-10',
    total: 12540000,
    paid: 12540000,
    status: 'PAID',
    agingBucket: null,
  },
  {
    id: 'i-0586',
    code: 'INV-2025-0586',
    tenant: 'Tech Solutions UZB MChJ',
    buildingName: 'Mega Mall',
    unitCode: 'Unit 301',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-10',
    total: 8760000,
    paid: 5200000,
    status: 'PARTIALLY_PAID',
    agingBucket: '0-30',
  },
  {
    id: 'i-0585',
    code: 'INV-2025-0585',
    tenant: 'Creative Agency',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 705',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-25',
    total: 5320000,
    paid: 0,
    status: 'ISSUED',
    agingBucket: '0-30',
  },
  {
    id: 'i-0584',
    code: 'INV-2025-0584',
    tenant: 'Dream Retail',
    buildingName: 'Mega Mall',
    unitCode: 'Unit 204',
    period: 'Mart 2025',
    issuedAt: '2025-03-01',
    dueAt: '2025-03-10',
    total: 7890000,
    paid: 0,
    status: 'OVERDUE',
    agingBucket: '61-90',
  },
  {
    id: 'i-0583',
    code: 'INV-2025-0583',
    tenant: 'Global Logistics & Trans',
    buildingName: 'Harmony Residence',
    unitCode: 'Unit A-502',
    period: 'Aprel 2025',
    issuedAt: '2025-04-01',
    dueAt: '2025-04-10',
    total: 9145000,
    paid: 4000000,
    status: 'PARTIALLY_PAID',
    agingBucket: '31-60',
  },
  {
    id: 'i-0582',
    code: 'INV-2025-0582',
    tenant: 'FinTech Services',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 703',
    period: 'Fevral 2025',
    issuedAt: '2025-02-01',
    dueAt: '2025-02-10',
    total: 6480000,
    paid: 0,
    status: 'OVERDUE',
    agingBucket: '90+',
  },
  {
    id: 'i-0581',
    code: 'INV-2025-0581',
    tenant: 'Mega Invest Group',
    buildingName: 'Industrial Park 2',
    unitCode: 'Unit B-12',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-20',
    total: 24000000,
    paid: 24000000,
    status: 'PAID',
    agingBucket: null,
  },
  {
    id: 'i-0580',
    code: 'INV-2025-0580',
    tenant: 'Urban Office MCHJ',
    buildingName: 'Green Business Center',
    unitCode: 'Unit 501',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-10',
    total: 25900000,
    paid: 25900000,
    status: 'PAID',
    agingBucket: null,
  },
])

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
      .filter((i) => i.status === 'OVERDUE')
      .reduce((s, i) => s + Math.max(0, i.total - i.paid), 0),
    count: live.length,
    paidCount: live.filter((i) => i.paid >= i.total).length,
  }
}

export type AgingKey = '0-30' | '31-60' | '61-90' | '90+'

export interface AgingRow {
  key: AgingKey
  bucket: string
  share: number
  amount: number
  tone: 'ok' | 'brand' | 'warn' | 'danger'
}

const AGING_BUCKETS: Array<Pick<AgingRow, 'key' | 'bucket' | 'tone'>> = [
  { key: '0-30', bucket: '0–30 kun', tone: 'ok' },
  { key: '31-60', bucket: '31–60 kun', tone: 'brand' },
  { key: '61-90', bucket: '61–90 kun', tone: 'warn' },
  { key: '90+', bucket: '90+ kun', tone: 'danger' },
]

/** Qarzdorlikning muddat guruhlari bo‘yicha taqsimoti */
export function agingOf(list: Invoice[] = INVOICES): AgingRow[] {
  const open = settledInvoices(list).filter((i) => i.total - i.paid > 0)
  const total = open.reduce((s, i) => s + (i.total - i.paid), 0)
  return AGING_BUCKETS.map((b) => {
    const amount = open
      .filter((i) => (i.agingBucket ?? '0-30') === b.key)
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

export const TARIFF_LINES = [
  { service: 'Elektr energiyasi', unit: 'kVt-soat', tariff: 1250, qty: 4800, sum: 6000000 },
  { service: 'Suv ta’minoti', unit: 'm³', tariff: 9000, qty: 120, sum: 1080000 },
  { service: 'Issiqlik ta’minoti', unit: 'Gkal', tariff: 160000, qty: 8, sum: 1280000 },
  { service: 'Boshqaruv xizmati', unit: 'm²', tariff: 3000, qty: 200, sum: 600000 },
  { service: 'Tozalash xizmati', unit: 'm²', tariff: 2000, qty: 200, sum: 400000 },
]
