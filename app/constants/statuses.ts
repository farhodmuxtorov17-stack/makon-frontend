/**
 * Barcha status enumlari: texnik spetsifikatsiya §3.4.
 *
 * Har bir status uchun rang bilan birga `shape` beriladi: talab bo‘yicha
 * status faqat rang bilan emas, matn va shakl bilan ham farqlanishi kerak
 * (§8.4, §22.4: rang ko‘rmaydigan foydalanuvchilar uchun).
 *
 * Nom qayerdan olinadi. Bu yerdagi `label` faqat zaxira qiymat: ko‘rinadigan
 * nom `i18n/locales/*.json` dagi `status.<kind>.<VALUE>` kalitidan olinadi va
 * ikkalasi bir xil bo‘lishi shart. Ekran statusni matn qilib chiqarganda ham
 * `UiStatus` yoki `useAppLabels().statusLabel()` ishlatsin, aks holda bitta
 * status ikki manbadan ikki xil nom oladi (filtr «Qoralama», nishoncha
 * «Loyiha» holati) va til almashtirilganda nishoncha tarjima bo‘lib, filtr
 * o‘zbekcha qolib ketadi.
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
  // Ranglar mijoz maketidagi legendaga mos: bo‘sh, yashil, ijarada: ko‘k,
  // sotilgan: qizil, rezerv: sariq, texnik: kulrang.
  RESERVED: { label: 'Rezerv', tone: 'warn', shape: 'dot' },
  RENTED: { label: 'Ijarada', tone: 'brand', shape: 'check' },
  SOLD: { label: 'Sotilgan', tone: 'danger', shape: 'check' },
  MAINTENANCE: { label: 'Ta’mirda', tone: 'neutral', shape: 'bar' },
  HIDDEN: { label: 'Yashirilgan', tone: 'neutral', shape: 'cross' },
  ARCHIVED: { label: 'Arxivlangan', tone: 'neutral', shape: 'square' },
}

/**
 * Qavat rejasi va 3D navigator uchun yagona rang jadvali. Mijoz maketidagi
 * legenda: bo‘sh yashil, ijarada ko‘k, sotilgan qizil, rezerv sariq, texnik
 * va qolgan holatlar kulrang. Ekranlar shu jadvaldan o‘qiydi, shuning uchun
 * bitta rang ikki xil ma’noni bildirib qolmaydi.
 */
export const UNIT_STATUS_COLOR: Record<string, string> = {
  VACANT: '#16B99A',
  RESERVED: '#FAA53F',
  APPLICATION_IN_REVIEW: '#FAA53F',
  RENTED: '#0256F7',
  SOLD: '#F84448',
  MAINTENANCE: '#8494AC',
  DRAFT: '#8494AC',
  HIDDEN: '#8494AC',
  ARCHIVED: '#8494AC',
}

/*
 * Bandlik shkalasi reyestrdagi haqiqiy taqsimotga tayanadi: 22 obyektda
 * qiymatlar 29% dan 95% gacha, o'rtasi 64% atrofida.
 *
 * Ilgari chegaralar 90 va 84 edi, ular esa bandlik boshqacha hisoblanadigan
 * paytdan qolgan. Natijada «84% - 89%» varianti hech qachon birorta obyekt
 * qaytarmasdi: shu oraliqda bitta ham obyekt yo'q edi.
 */
export const OCCUPANCY_BANDS = [
  { min: 65, labelKey: 'landing.occupancyHigh', label: '65% va undan yuqori', class: 'bg-ok-500' },
  { min: 50, labelKey: 'landing.occupancyMid', label: '50% - 64%', class: 'bg-brand-500' },
  { min: 0, labelKey: 'landing.occupancyLow', label: '50% dan past', class: 'bg-warn-500' },
]

export const LISTING_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: 'Qoralama', tone: 'neutral', shape: 'square' },
  PUBLISHED: { label: 'E’lon qilingan', tone: 'ok', shape: 'check' },
  PAUSED: { label: 'To‘xtatilgan', tone: 'warn', shape: 'bar' },
  ARCHIVED: { label: 'Arxivlangan', tone: 'neutral', shape: 'square' },
}

/**
 * Ijara sikli: arizadan yopilgan arizagacha bo‘lgan yagona status mashinasi.
 * Ijarachi, operator va buxgalter ekranlari shu registrdan o‘qiydi, shuning
 * uchun uch rol bir xil nom va belgini ko‘radi.
 *
 * Bosqichlar buyurtmachi ta’rifiga mos: ariza kelgach operator uni tasdiqlaydi
 * va shu zahoti shartnoma tuziladi, so‘ng hujjat Didox orqali imzolanadi va
 * ariza yopiladi. Oraliq moliya tasdig‘i jarayonda yo‘q.
 */
export const LEASE_STATUS: Record<string, StatusDef> = {
  YANGI: { label: 'Yangi ariza', tone: 'brand', shape: 'dot' },
  SHARTNOMA_TAYYOR: { label: 'Shartnoma tayyorlandi', tone: 'violet', shape: 'square' },
  DIDOX_YUBORILDI: { label: 'Didox’ga yuborildi', tone: 'warn', shape: 'bar' },
  DIDOX_IMZOLANDI: { label: 'Didox’da imzolandi', tone: 'brand', shape: 'check' },
  FAOL: { label: 'Ariza yopildi', tone: 'ok', shape: 'check' },
  RAD_ETILDI: { label: 'Rad etilgan', tone: 'danger', shape: 'cross' },
}

export const CONTRACT_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: 'Qoralama', tone: 'neutral', shape: 'square' },
  REVIEW: { label: 'Kelishilmoqda', tone: 'warn', shape: 'clock' },
  SIGNED: { label: 'Imzolangan', tone: 'brand', shape: 'check' },
  ACTIVE: { label: 'Faol', tone: 'ok', shape: 'check' },
  EXPIRED: { label: 'Muddati tugagan', tone: 'neutral', shape: 'bar' },
  TERMINATED: { label: 'Bekor qilingan', tone: 'danger', shape: 'cross' },
  COMPLETED: { label: 'Yakunlangan', tone: 'neutral', shape: 'check' },
}

export const INVOICE_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: 'Qoralama', tone: 'neutral', shape: 'square' },
  ISSUED: { label: 'Chiqarilgan', tone: 'brand', shape: 'dot' },
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
  lease: LEASE_STATUS,
  contract: CONTRACT_STATUS,
  invoice: INVOICE_STATUS,
  service: SERVICE_STATUS,
  material: MATERIAL_STATUS,
} as const

export type StatusKind = keyof typeof STATUS_REGISTRY

/**
 * Ma’lumot bazasida enum emas, o‘zbekcha qiymat sifatida saqlanadigan
 * ro‘yxatlar (ustuvorlik, to‘lov davriyligi, Didox holati) uchun tarjima
 * kaliti jadvali. Qiymatning o‘zi o‘zgarmaydi, faqat ko‘rinadigan nom
 * tanlangan tilga bog‘lanadi: `useAppLabels().priorityLabel()` va hokazo.
 */
export const PRIORITY_KEY: Record<string, string> = {
  Past: 'priority.low',
  'O‘rtacha': 'priority.medium',
  Yuqori: 'priority.high',
}

/** Ustuvorlik faqat rang bilan emas, shakl bilan ham farqlanadi */
export const PRIORITY_MARK: Record<string, { tone: Tone; shape: Shape }> = {
  Past: { tone: 'neutral', shape: 'bar' },
  'O‘rtacha': { tone: 'warn', shape: 'ring' },
  Yuqori: { tone: 'danger', shape: 'dot' },
}

export const PERIODICITY_KEY: Record<string, string> = {
  Oylik: 'periodicity.monthly',
  Choraklik: 'periodicity.quarterly',
  Yillik: 'periodicity.yearly',
}

export const DIDOX_KEY: Record<string, string> = {
  Yuborilgan: 'didox.sent',
  'Ko‘rib chiqilmoqda': 'didox.review',
  Imzolangan: 'didox.signed',
}

export const TONE_BADGE: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  ok: 'bg-ok-50 text-ok-800 ring-ok-100',
  warn: 'bg-warn-50 text-warn-800 ring-warn-100',
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
