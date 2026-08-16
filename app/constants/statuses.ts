/**
 * Barcha status enumlari — texnik spetsifikatsiya §3.4.
 *
 * Har bir status uchun rang bilan birga `shape` beriladi: talab bo‘yicha
 * status faqat rang bilan emas, matn va shakl bilan ham farqlanishi kerak
 * (§8.4, §22.4 — rang ko‘rmaydigan foydalanuvchilar uchun).
 */

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'violet'
export type Shape = 'dot' | 'ring' | 'square' | 'check' | 'cross' | 'clock' | 'bar'

export interface StatusDef {
  label: string
  tone: Tone
  shape: Shape
}

export const UNIT_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: 'Qoralama', tone: 'neutral', shape: 'square' },
  VACANT: { label: 'Bo‘sh', tone: 'ok', shape: 'ring' },
  APPLICATION_IN_REVIEW: { label: 'Ariza ko‘rikda', tone: 'warn', shape: 'clock' },
  // Ranglar mijoz maketidagi legendaga mos: bo‘sh — yashil, ijarada — ko‘k,
  // sotilgan — qizil, rezerv — sariq, texnik — kulrang.
  RESERVED: { label: 'Rezerv', tone: 'warn', shape: 'dot' },
  RENTED: { label: 'Ijarada', tone: 'brand', shape: 'check' },
  SOLD: { label: 'Sotilgan', tone: 'danger', shape: 'check' },
  MAINTENANCE: { label: 'Ta’mirda', tone: 'neutral', shape: 'bar' },
  HIDDEN: { label: 'Yashirilgan', tone: 'neutral', shape: 'cross' },
  ARCHIVED: { label: 'Arxivlangan', tone: 'neutral', shape: 'square' },
}

export const LISTING_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: 'Qoralama', tone: 'neutral', shape: 'square' },
  PUBLISHED: { label: 'E’lon qilingan', tone: 'ok', shape: 'check' },
  PAUSED: { label: 'To‘xtatilgan', tone: 'warn', shape: 'bar' },
  ARCHIVED: { label: 'Arxivlangan', tone: 'neutral', shape: 'square' },
}

export const APPLICATION_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: 'Qoralama', tone: 'neutral', shape: 'square' },
  SUBMITTED: { label: 'Yuborilgan', tone: 'brand', shape: 'dot' },
  BUILDING_REVIEW: { label: 'Bino ko‘rigida', tone: 'warn', shape: 'clock' },
  FINANCE_REVIEW: { label: 'Moliya ko‘rigida', tone: 'warn', shape: 'clock' },
  OFFER_SENT: { label: 'Taklif yuborilgan', tone: 'brand', shape: 'ring' },
  OFFER_ACCEPTED: { label: 'Taklif qabul qilindi', tone: 'ok', shape: 'check' },
  DOCUMENTS: { label: 'Hujjatlar', tone: 'brand', shape: 'bar' },
  APPROVED: { label: 'Tasdiqlangan', tone: 'ok', shape: 'check' },
  REJECTED: { label: 'Rad etilgan', tone: 'danger', shape: 'cross' },
  CANCELLED: { label: 'Bekor qilingan', tone: 'neutral', shape: 'cross' },
  COMPLETED: { label: 'Yakunlangan', tone: 'ok', shape: 'check' },
}

/**
 * Ijara sikli — unit tanlashdan faol shartnomagacha bo‘lgan yagona status
 * mashinasi. Ijarachi, bino rahbari va buxgalter ekranlari shu registrdan
 * o‘qiydi, shuning uchun uch rol bir xil nom va belgini ko‘radi.
 */
export const LEASE_STATUS: Record<string, StatusDef> = {
  YANGI: { label: 'Yangi ariza', tone: 'brand', shape: 'dot' },
  OPERATSIYA_TASDIQLADI: { label: 'Operatsiya tasdiqladi', tone: 'warn', shape: 'clock' },
  MOLIYA_TASDIQLADI: { label: 'Moliya tasdiqladi', tone: 'violet', shape: 'ring' },
  QORALAMA_TAYYOR: { label: 'Qoralama tayyor', tone: 'brand', shape: 'square' },
  DIDOX_YUBORILDI: { label: 'Didox’ga yuborildi', tone: 'warn', shape: 'bar' },
  DIDOX_IMZOLANDI: { label: 'Didox’da imzolandi', tone: 'brand', shape: 'check' },
  FAOL: { label: 'Faol', tone: 'ok', shape: 'check' },
  RAD_ETILDI: { label: 'Rad etilgan', tone: 'danger', shape: 'cross' },
}

export const CONTRACT_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: 'Loyiha', tone: 'neutral', shape: 'square' },
  REVIEW: { label: 'Kelishilmoqda', tone: 'warn', shape: 'clock' },
  SIGNED: { label: 'Imzolangan', tone: 'brand', shape: 'check' },
  ACTIVE: { label: 'Faol', tone: 'ok', shape: 'check' },
  EXPIRED: { label: 'Muddati tugagan', tone: 'neutral', shape: 'bar' },
  TERMINATED: { label: 'Bekor qilingan', tone: 'danger', shape: 'cross' },
  COMPLETED: { label: 'Yakunlangan', tone: 'neutral', shape: 'check' },
}

export const INVOICE_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: 'Qoralama', tone: 'neutral', shape: 'square' },
  ISSUED: { label: 'Tasdiqlangan', tone: 'brand', shape: 'dot' },
  PARTIALLY_PAID: { label: 'Qisman to‘langan', tone: 'warn', shape: 'bar' },
  PAID: { label: 'To‘langan', tone: 'ok', shape: 'check' },
  OVERDUE: { label: 'Kechikkan', tone: 'danger', shape: 'clock' },
  CANCELLED: { label: 'Bekor qilingan', tone: 'neutral', shape: 'cross' },
}

export const SERVICE_STATUS: Record<string, StatusDef> = {
  NEW: { label: 'Yangi', tone: 'brand', shape: 'dot' },
  TRIAGE: { label: 'Ko‘rib chiqilmoqda', tone: 'warn', shape: 'clock' },
  ASSIGNED: { label: 'Biriktirilgan', tone: 'brand', shape: 'ring' },
  INSPECTION: { label: 'Tekshiruvda', tone: 'warn', shape: 'clock' },
  MATERIAL_PENDING: { label: 'Material kutilmoqda', tone: 'warn', shape: 'bar' },
  IN_PROGRESS: { label: 'Jarayonda', tone: 'brand', shape: 'bar' },
  COMPLETED: { label: 'Bajarilgan', tone: 'ok', shape: 'check' },
  TENANT_CONFIRMATION: { label: 'Tasdiqlashda', tone: 'violet', shape: 'clock' },
  CLOSED: { label: 'Yopilgan', tone: 'neutral', shape: 'check' },
  RETURNED: { label: 'Qaytarilgan', tone: 'danger', shape: 'bar' },
  REJECTED: { label: 'Rad etilgan', tone: 'danger', shape: 'cross' },
}

export const MATERIAL_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: 'Qoralama', tone: 'neutral', shape: 'square' },
  SUBMITTED: { label: 'Yuborilgan', tone: 'brand', shape: 'dot' },
  APPROVED: { label: 'Tasdiqlangan', tone: 'ok', shape: 'check' },
  REJECTED: { label: 'Rad etilgan', tone: 'danger', shape: 'cross' },
  ISSUED: { label: 'Berilgan', tone: 'violet', shape: 'check' },
  CANCELLED: { label: 'Bekor qilingan', tone: 'neutral', shape: 'cross' },
}

export const STATUS_REGISTRY = {
  unit: UNIT_STATUS,
  listing: LISTING_STATUS,
  application: APPLICATION_STATUS,
  lease: LEASE_STATUS,
  contract: CONTRACT_STATUS,
  invoice: INVOICE_STATUS,
  service: SERVICE_STATUS,
  material: MATERIAL_STATUS,
} as const

export type StatusKind = keyof typeof STATUS_REGISTRY

export const TONE_BADGE: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  ok: 'bg-ok-50 text-ok-700 ring-ok-100',
  warn: 'bg-warn-50 text-warn-700 ring-warn-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  violet: 'bg-info-50 text-info-700 ring-info-100',
}

export const TONE_MARK: Record<Tone, string> = {
  neutral: 'text-ink-400',
  brand: 'text-brand-500',
  ok: 'text-ok-500',
  warn: 'text-warn-500',
  danger: 'text-danger-500',
  violet: 'text-info-500',
}
