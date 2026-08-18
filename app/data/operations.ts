import { INVOICES } from '~/data/business'
import { dateShort, num, todayIso } from '~/utils/format'

/**
 * Operatsion ma’lumotlar: servis arizalari, ombor, material so‘rovlari,
 * hisoblagichlar va bildirishnomalar.
 *
 * Muhim qoida: bu faylda birorta KPI raqami qo‘lda yozilmaydi. Kartalardagi
 * son har doim shu fayldagi reyestrdan hisoblanadi, shuning uchun kartani
 * bosgan foydalanuvchi jadvalda aynan o‘sha sondagi qatorni ko‘radi.
 * Har bir jamlanma uchun `build...()` funksiyasi eksport qilinadi: ekran
 * o‘zining ko‘rish doirasiga (rol bo‘yicha filtrlangan ro‘yxatga) tayangan
 * holda o‘sha funksiyani chaqirishi mumkin.
 */

/** "2025-05-08" yoki "2025-05-08 09:05" ko‘rinishidagi ikki sana orasidagi kun */
function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime()
  const b = new Date(`${toIso.slice(0, 10)}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}

/** "2025-05-08 09:05" va "2025-05-08 14:40" orasidagi soat, kasr bilan */
function hoursBetween(fromAt: string, toAt: string): number {
  const a = new Date(fromAt.replace(' ', 'T')).getTime()
  const b = new Date(toAt.replace(' ', 'T')).getTime()
  return (b - a) / 3600000
}

// ---------------------------------------------------------------------------
// Servis arizalari

export interface ServiceRequest {
  id: string
  code: string
  title: string
  category: 'Santexnika' | 'Elektr' | 'Konditsioner' | 'Qurilish' | 'Tozalash' | 'Boshqa'
  buildingName: string
  unitCode: string
  requester: string
  priority: 'Past' | 'O‘rtacha' | 'Yuqori'
  status:
    | 'NEW'
    | 'TRIAGE'
    | 'ASSIGNED'
    | 'INSPECTION'
    | 'MATERIAL_PENDING'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'TENANT_CONFIRMATION'
    | 'CLOSED'
    | 'RETURNED'
  assignee: string | null
  createdAt: string
  dueAt: string
  slaBreached: boolean
  description: string
  progress: number
  /**
   * Ish haqiqatda tugatilgan payt. "O‘rtacha bajarish vaqti" KPI si shu
   * maydondan hisoblanadi, shuning uchun tugallanmagan arizada bo‘sh turadi.
   */
  completedAt?: string
}

export const SERVICE_REQUESTS: ServiceRequest[] = [
  {
    id: 's-0712',
    code: 'SR-2025-0712',
    title: 'Fasad bo‘yash ishlari',
    category: 'Qurilish',
    buildingName: 'Green Business Center',
    unitCode: 'Umumiy zona',
    requester: 'Sardor Yo‘ldoshev',
    priority: 'O‘rtacha',
    status: 'NEW',
    assignee: null,
    createdAt: '2025-05-18 08:40',
    dueAt: '2025-05-28',
    slaBreached: false,
    description:
      'Bino old fasadining 1–3-qavat oralig‘idagi bo‘yoq qatlami ko‘chgan. Tozalash va qayta bo‘yash talab etiladi.',
    progress: 0,
  },
  {
    id: 's-0708',
    code: 'SR-2025-0708',
    title: 'Elektr yoritish o‘rnatish',
    category: 'Elektr',
    buildingName: 'Green Business Center',
    unitCode: '5-qavat, koridor',
    requester: 'Dilshod Ergashev',
    priority: 'Yuqori',
    status: 'IN_PROGRESS',
    assignee: 'Jasur Toshmatov',
    createdAt: '2025-05-14 11:20',
    dueAt: '2025-05-22',
    slaBreached: false,
    description:
      '5-qavat koridorida LED yoritish tizimini o‘rnatish, eski armaturalarni almashtirish va yoritish darajasini o‘lchash.',
    progress: 65,
  },
  {
    id: 's-0703',
    code: 'SR-2025-0703',
    title: 'Santexnika montaj ishlari',
    category: 'Santexnika',
    buildingName: 'Mega Mall',
    unitCode: '204',
    requester: 'Dream Retail',
    priority: 'Yuqori',
    status: 'COMPLETED',
    assignee: 'Jasur Toshmatov',
    createdAt: '2025-05-08 09:05',
    dueAt: '2025-05-15',
    slaBreached: false,
    description: 'Sanuzeldagi quvur oqishini bartaraf etish va aralashtirgichni almashtirish.',
    progress: 100,
    completedAt: '2025-05-08 14:40',
  },
  {
    id: 's-0699',
    code: 'SR-2025-0699',
    title: 'Hovli obodonlashtirish',
    category: 'Qurilish',
    buildingName: 'Harmony Residence',
    unitCode: 'Umumiy zona',
    requester: 'Nigora Aripova',
    priority: 'Past',
    status: 'RETURNED',
    assignee: 'Jasur Toshmatov',
    createdAt: '2025-05-02 15:30',
    dueAt: '2025-05-16',
    slaBreached: true,
    description:
      'Hovli yo‘lakchalarini ta’mirlash va ko‘kalamzorlashtirish. Qabul qilishda sifat talabga javob bermadi.',
    progress: 80,
  },
  {
    id: 's-0690',
    code: 'SR-2025-0690',
    title: 'Zinalarga qo‘shimcha yoritish',
    category: 'Elektr',
    buildingName: 'Urban Office',
    unitCode: 'Zinapoya',
    requester: 'Otabek Rahimov',
    priority: 'O‘rtacha',
    status: 'IN_PROGRESS',
    assignee: 'Jasur Toshmatov',
    createdAt: '2025-04-28 10:10',
    dueAt: '2025-05-12',
    slaBreached: true,
    description: 'Zinapoyalarda avariya yoritgichlarini o‘rnatish va datchiklarni sozlash.',
    progress: 45,
  },
  {
    id: 's-0685',
    code: 'SR-2025-0685',
    title: 'Suv oqish muammosi',
    category: 'Santexnika',
    buildingName: 'Green Business Center',
    unitCode: '708',
    requester: '«Grand Trade» MCHJ',
    priority: 'Yuqori',
    status: 'NEW',
    assignee: null,
    createdAt: '2025-05-17 17:45',
    dueAt: '2025-05-20',
    slaBreached: false,
    description: 'Sanuzelda quvurdan suv oqmoqda, shift qoplamasi namlangan.',
    progress: 0,
  },
  {
    id: 's-0684',
    code: 'SR-2025-0684',
    title: 'Yoritish ishlamayapti',
    category: 'Elektr',
    buildingName: 'Green Business Center',
    unitCode: '708',
    requester: '«Grand Trade» MCHJ',
    priority: 'O‘rtacha',
    status: 'TRIAGE',
    assignee: null,
    createdAt: '2025-05-16 09:30',
    dueAt: '2025-05-23',
    slaBreached: false,
    description: 'Ish xonasidagi ikkita LED panel yonmayapti.',
    progress: 10,
  },
  {
    id: 's-0680',
    code: 'SR-2025-0680',
    title: 'Eshik qulfi bo‘shashgan',
    category: 'Boshqa',
    buildingName: 'Green Business Center',
    unitCode: '708',
    requester: '«Grand Trade» MCHJ',
    priority: 'Past',
    status: 'IN_PROGRESS',
    assignee: 'Jasur Toshmatov',
    createdAt: '2025-05-13 14:00',
    dueAt: '2025-05-21',
    slaBreached: false,
    description: 'Kirish eshigining qulfi yaxshi yopilmayapti, mexanizmni sozlash kerak.',
    progress: 55,
  },
]

export function serviceRequestByCode(code: string): ServiceRequest | undefined {
  return SERVICE_REQUESTS.find((r) => r.code === code)
}

// ---------------------------------------------------------------------------
// Servis KPI: barcha sonlar ro‘yxatdan hisoblanadi

export type ServiceKpiTone = 'brand' | 'ok' | 'warn' | 'danger' | 'violet' | 'neutral'

export interface ServiceKpiSlice {
  label: string
  count: number
  /** Ulush foizda, butun songa yaxlitlangan */
  share: number
  tone: ServiceKpiTone
}

export interface ServiceKpi {
  /** Ro‘yxatdagi jami ariza soni */
  total: number
  /** NEW statusidagi arizalar. Kartani bosganda jadval shu bo‘yicha filtrlanadi */
  newCount: number
  /** IN_PROGRESS statusidagi arizalar */
  inProgress: number
  /**
   * COMPLETED statusidagi arizalar. Nomi eski ekran bilan mos bo‘lishi uchun
   * saqlanib qolgan, mazmuni "bajarilgan" arizalar soni.
   */
  completedToday: number
  /** Tugallangan arizalarning o‘rtacha bajarilish vaqti, soatda */
  avgHours: number
  /** Doira diagramma bo‘laklari: bo‘sh guruhlar tushib qoladi */
  breakdown: ServiceKpiSlice[]
}

/**
 * Diagramma guruhlari. Har bir status aynan bitta guruhga tushadi, shuning
 * uchun bo‘laklar yig‘indisi doim ro‘yxatdagi ariza soniga teng bo‘ladi.
 */
const SERVICE_GROUPS: Array<{
  label: string
  tone: ServiceKpiTone
  statuses: ServiceRequest['status'][]
}> = [
  { label: 'Yangi', tone: 'brand', statuses: ['NEW'] },
  { label: 'Saralashda', tone: 'violet', statuses: ['TRIAGE', 'ASSIGNED', 'INSPECTION'] },
  { label: 'Jarayonda', tone: 'warn', statuses: ['MATERIAL_PENDING', 'IN_PROGRESS'] },
  { label: 'Bajarilgan', tone: 'ok', statuses: ['COMPLETED', 'TENANT_CONFIRMATION'] },
  { label: 'Yopilgan', tone: 'neutral', statuses: ['CLOSED'] },
  { label: 'Qaytarilgan', tone: 'danger', statuses: ['RETURNED'] },
]

export function buildServiceKpi(list: ServiceRequest[] = SERVICE_REQUESTS): ServiceKpi {
  const total = list.length
  const finished = list.filter((r) => !!r.completedAt)
  const avgHours = finished.length
    ? Math.round(
        (finished.reduce((s, r) => s + hoursBetween(r.createdAt, r.completedAt!), 0) /
          finished.length) *
          10,
      ) / 10
    : 0

  const breakdown = SERVICE_GROUPS.map((g) => {
    const count = list.filter((r) => g.statuses.includes(r.status)).length
    return {
      label: g.label,
      count,
      share: total ? Math.round((count / total) * 100) : 0,
      tone: g.tone,
    }
  }).filter((b) => b.count > 0)

  return {
    total,
    newCount: list.filter((r) => r.status === 'NEW').length,
    inProgress: list.filter((r) => r.status === 'IN_PROGRESS').length,
    completedToday: list.filter((r) => r.status === 'COMPLETED').length,
    avgHours,
    breakdown,
  }
}

export const SERVICE_KPI: ServiceKpi = buildServiceKpi()

// ---------------------------------------------------------------------------
// Ombor reyestri

export interface StockItem {
  id: string
  code: string
  name: string
  category: 'Mebel' | 'Elektr jihozlar' | 'Sanitariya' | 'Qurilish' | 'IT jihozlar' | 'Boshqalar'
  unit: string
  qty: number
  minQty: number
  price: number
  warehouse: string
  addedAt: string
}

export const STOCK_ITEMS: StockItem[] = [
  {
    id: 'w-01',
    code: 'MB-0012',
    name: 'Stol (ishchi)',
    category: 'Mebel',
    unit: 'dona',
    qty: 28,
    minQty: 10,
    price: 1850000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-05-12',
  },
  {
    id: 'w-02',
    code: 'MB-0018',
    name: 'Stul (ofis)',
    category: 'Mebel',
    unit: 'dona',
    qty: 56,
    minQty: 20,
    price: 720000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-05-12',
  },
  {
    id: 'w-03',
    code: 'EL-0041',
    name: 'Konditsioner filtri',
    category: 'Elektr jihozlar',
    unit: 'dona',
    qty: 120,
    minQty: 30,
    price: 145000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-05-09',
  },
  {
    id: 'w-04',
    code: 'EL-0055',
    name: 'Kabel (UTP Cat6)',
    category: 'Elektr jihozlar',
    unit: 'metr',
    qty: 350,
    minQty: 100,
    price: 12000,
    warehouse: 'Green BC ombori',
    addedAt: '2025-05-06',
  },
  {
    id: 'w-05',
    code: 'EL-0063',
    name: 'Lampa LED 18W',
    category: 'Elektr jihozlar',
    unit: 'dona',
    qty: 80,
    minQty: 60,
    price: 68000,
    warehouse: 'Green BC ombori',
    addedAt: '2025-05-04',
  },
  {
    id: 'w-06',
    code: 'SN-0009',
    name: 'Sanitariya jihozlari to‘plami',
    category: 'Sanitariya',
    unit: 'to‘plam',
    qty: 15,
    minQty: 20,
    price: 2400000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-04-28',
  },
  {
    id: 'w-07',
    code: 'QR-0027',
    name: 'Sement M400',
    category: 'Qurilish',
    unit: 'qop',
    qty: 210,
    minQty: 50,
    price: 58000,
    warehouse: 'Industrial Park ombori',
    addedAt: '2025-05-14',
  },
  {
    id: 'w-08',
    code: 'IT-0004',
    name: 'Wi-Fi router',
    category: 'IT jihozlar',
    unit: 'dona',
    qty: 18,
    minQty: 8,
    price: 890000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-05-02',
  },
  {
    id: 'w-09',
    code: 'EL-0071',
    name: 'LED armatura 60W',
    category: 'Elektr jihozlar',
    unit: 'dona',
    qty: 64,
    minQty: 20,
    price: 320000,
    warehouse: 'Green BC ombori',
    addedAt: '2025-05-13',
  },
  {
    id: 'w-10',
    code: 'EL-0080',
    name: 'Elektr kabel NYM 3x1.5',
    category: 'Elektr jihozlar',
    unit: 'metr',
    qty: 640,
    minQty: 200,
    price: 18000,
    warehouse: 'Green BC ombori',
    addedAt: '2025-05-13',
  },
  {
    id: 'w-11',
    code: 'EL-0092',
    name: 'Avtomat 1P 10A',
    category: 'Elektr jihozlar',
    unit: 'dona',
    qty: 46,
    minQty: 15,
    price: 95000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-05-10',
  },
  {
    id: 'w-12',
    code: 'EL-0098',
    name: 'Harakat datchigi',
    category: 'Elektr jihozlar',
    unit: 'dona',
    qty: 22,
    minQty: 10,
    price: 142000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-05-07',
  },
  {
    id: 'w-13',
    code: 'SN-0014',
    name: 'Aralashtirgich (universal)',
    category: 'Sanitariya',
    unit: 'dona',
    qty: 24,
    minQty: 8,
    price: 480000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-05-05',
  },
  {
    id: 'w-14',
    code: 'SN-0021',
    name: 'PPR quvur 25 mm',
    category: 'Sanitariya',
    unit: 'metr',
    qty: 180,
    minQty: 60,
    price: 26000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-05-05',
  },
  {
    id: 'w-15',
    code: 'SN-0025',
    name: 'Silikon germetik',
    category: 'Sanitariya',
    unit: 'tuba',
    qty: 40,
    minQty: 15,
    price: 42000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-04-30',
  },
  {
    id: 'w-16',
    code: 'QR-0033',
    name: 'Trotuar plitkasi',
    category: 'Qurilish',
    unit: 'm²',
    qty: 240,
    minQty: 80,
    price: 95000,
    warehouse: 'Industrial Park ombori',
    addedAt: '2025-05-14',
  },
  {
    id: 'w-17',
    code: 'QR-0038',
    name: 'Bordyur toshi',
    category: 'Qurilish',
    unit: 'dona',
    qty: 96,
    minQty: 30,
    price: 78000,
    warehouse: 'Industrial Park ombori',
    addedAt: '2025-05-14',
  },
  {
    id: 'w-18',
    code: 'QR-0041',
    name: 'Qurilish qumi',
    category: 'Qurilish',
    unit: 'm³',
    qty: 34,
    minQty: 10,
    price: 180000,
    warehouse: 'Industrial Park ombori',
    addedAt: '2025-05-11',
  },
  {
    id: 'w-19',
    code: 'QR-0052',
    name: 'Fasad bo‘yog‘i',
    category: 'Qurilish',
    unit: 'litr',
    qty: 320,
    minQty: 100,
    price: 46000,
    warehouse: 'Industrial Park ombori',
    addedAt: '2025-05-11',
  },
  {
    id: 'w-20',
    code: 'QR-0055',
    name: 'Fasad grunti',
    category: 'Qurilish',
    unit: 'litr',
    qty: 150,
    minQty: 50,
    price: 32000,
    warehouse: 'Industrial Park ombori',
    addedAt: '2025-05-11',
  },
  {
    id: 'w-21',
    code: 'BS-0002',
    name: 'Eshik qulfi mexanizmi',
    category: 'Boshqalar',
    unit: 'dona',
    qty: 12,
    minQty: 5,
    price: 260000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-05-03',
  },
  {
    id: 'w-22',
    code: 'BS-0007',
    name: 'Universal moylash spreyi',
    category: 'Boshqalar',
    unit: 'ballon',
    qty: 30,
    minQty: 10,
    price: 38000,
    warehouse: 'Markaziy ombor',
    addedAt: '2025-05-03',
  },
  {
    id: 'w-23',
    code: 'BS-0011',
    name: 'Dekorativ ko‘chat',
    category: 'Boshqalar',
    unit: 'dona',
    qty: 45,
    minQty: 15,
    price: 85000,
    warehouse: 'Industrial Park ombori',
    addedAt: '2025-04-29',
  },
]

export function stockByCode(code: string): StockItem | undefined {
  return STOCK_ITEMS.find((i) => i.code === code)
}

const STOCK_CATEGORY_ICONS: Record<StockItem['category'], string> = {
  Mebel: 'box',
  'Elektr jihozlar': 'sparkle',
  Sanitariya: 'wrench',
  Qurilish: 'layers',
  'IT jihozlar': 'cube',
  Boshqalar: 'clipboard',
}

export interface StockCategoryCard {
  label: StockItem['category']
  icon: string
  count: number
}

/**
 * Kategoriya kartalari. Son reyestrdan sanaladi va bo‘sh kategoriya
 * umuman ko‘rsatilmaydi, chunki karta bosilganda jadval shu kategoriya
 * bo‘yicha filtrlanadi va bo‘sh natija chiqishi mumkin emas.
 */
export function buildStockCategories(list: StockItem[] = STOCK_ITEMS): StockCategoryCard[] {
  return (Object.keys(STOCK_CATEGORY_ICONS) as StockItem['category'][])
    .map((label) => ({
      label,
      icon: STOCK_CATEGORY_ICONS[label],
      count: list.filter((i) => i.category === label).length,
    }))
    .filter((c) => c.count > 0)
}

export const STOCK_CATEGORIES: StockCategoryCard[] = buildStockCategories()

// ---------------------------------------------------------------------------
// Ish materiallari va chek-list
//
// Materiallarning yagona manbasi ombor reyestri: har bir qator ombordagi
// pozitsiya kodiga bog‘lanadi, nomi, o‘lchov birligi va narxi shu yerdan
// olinadi. Shuning uchun ish akti, material so‘rovi summasi va ombor
// dalolatnomasi bitta raqamni ko‘rsatadi.

export interface WorkMaterialLine {
  /** Ombor reyestridagi pozitsiya kodi */
  code: string
  name: string
  qty: number
  unit: string
  price: number
}

/** Ariza kodi -> ombordan berilgan (yoki rejalashtirilgan) pozitsiyalar */
const WORK_MATERIAL_REFS: Record<string, Array<{ code: string; qty: number }>> = {
  'SR-2025-0712': [
    { code: 'QR-0052', qty: 80 },
    { code: 'QR-0055', qty: 30 },
  ],
  'SR-2025-0708': [
    { code: 'EL-0071', qty: 24 },
    { code: 'EL-0080', qty: 180 },
    { code: 'EL-0092', qty: 12 },
  ],
  'SR-2025-0703': [
    { code: 'SN-0009', qty: 1 },
    { code: 'SN-0021', qty: 40 },
    { code: 'SN-0014', qty: 2 },
    { code: 'SN-0025', qty: 6 },
  ],
  'SR-2025-0699': [
    { code: 'QR-0027', qty: 40 },
    { code: 'QR-0033', qty: 30 },
    { code: 'QR-0038', qty: 24 },
    { code: 'QR-0041', qty: 6 },
    { code: 'BS-0011', qty: 12 },
  ],
  'SR-2025-0690': [
    { code: 'EL-0071', qty: 8 },
    { code: 'EL-0098', qty: 6 },
  ],
  'SR-2025-0685': [
    { code: 'SN-0021', qty: 12 },
    { code: 'SN-0025', qty: 3 },
  ],
  'SR-2025-0684': [{ code: 'EL-0063', qty: 20 }],
  'SR-2025-0680': [
    { code: 'BS-0002', qty: 1 },
    { code: 'BS-0007', qty: 1 },
  ],
}

/** Arizaga tegishli materiallar. Noma’lum ariza uchun bo‘sh ro‘yxat qaytadi */
export function materialsFor(orderCode: string): WorkMaterialLine[] {
  return (WORK_MATERIAL_REFS[orderCode] ?? []).flatMap((ref) => {
    const item = stockByCode(ref.code)
    if (!item) return []
    return [{ code: item.code, name: item.name, qty: ref.qty, unit: item.unit, price: item.price }]
  })
}

/** Ariza bo‘yicha material qiymati: ish akti va material so‘rovi uchun bitta raqam */
export function materialsTotal(orderCode: string): number {
  return materialsFor(orderCode).reduce((s, m) => s + m.qty * m.price, 0)
}

/** Ombor berish dalolatnomasi qatorlari: miqdor haqiqiy material qatoridan olinadi */
export function issueLinesFor(orderCode: string): Array<{ name: string; unit: string; qty: number }> {
  return materialsFor(orderCode).map((m) => ({ name: m.name, unit: m.unit, qty: m.qty }))
}

export interface WorkChecklistItem {
  label: string
  done: boolean
}

/** Chek-list ariza kategoriyasiga bog‘liq: santexnikada elektr bandi chiqmaydi */
const CHECKLIST_BY_CATEGORY: Record<ServiceRequest['category'], string[]> = {
  Elektr: [
    'Materiallar sifatini tekshirish',
    'Kuchlanishni uzish va xavfsizlikni ta’minlash',
    'Eski armaturalarni demontaj qilish',
    'O‘rnatish va ulash ishlari',
    'Yoritish darajasi o‘lchovi',
    'Tozalash va ish joyini topshirish',
  ],
  Santexnika: [
    'Suvni to‘sish va tizimni bo‘shatish',
    'Eski jihozni demontaj qilish',
    'Yangi jihozni o‘rnatish',
    'Bosim ostida germetiklikni sinash',
    'Tozalash va ish joyini topshirish',
  ],
  Konditsioner: [
    'Bloklarni ko‘zdan kechirish',
    'Freon bosimini o‘lchash',
    'Filtrni tozalash yoki almashtirish',
    'Sinov rejimida ishga tushirish',
    'Ish joyini topshirish',
  ],
  Qurilish: [
    'Yuzani tayyorlash va tozalash',
    'Materiallarni obyektga yetkazish',
    'Asosiy qurilish-ta’mirlash ishlari',
    'Sifat nazorati va o‘lchovlar',
    'Ish joyini tozalab topshirish',
  ],
  Tozalash: [
    'Inventar va vositalarni tayyorlash',
    'Hududni tozalash',
    'Chiqindini chiqarib tashlash',
    'Natijani buyurtmachiga ko‘rsatish',
  ],
  Boshqa: [
    'Nosozlikni joyida aniqlash',
    'Mexanizmni sozlash yoki almashtirish',
    'Ishlashini sinovdan o‘tkazish',
    'Ish joyini topshirish',
  ],
}

/**
 * Bandlarning bajarilgani arizaning bajarilish foizidan kelib chiqadi,
 * shuning uchun progress va chek-list hech qachon bir-biriga zid bo‘lmaydi.
 */
export function checklistFor(
  request: Pick<ServiceRequest, 'category' | 'progress'>,
): WorkChecklistItem[] {
  const labels = CHECKLIST_BY_CATEGORY[request.category]
  const doneCount = Math.floor((labels.length * request.progress) / 100)
  return labels.map((label, i) => ({ label, done: i < doneCount }))
}

/**
 * Eski ekranlar uchun standart qiymat: ochiq elektr topshirig‘i SR-2025-0708.
 * Yangi ekran kodi `checklistFor(order)` va `materialsFor(order.code)` ni
 * chaqirishi kerak, shunda har bir arizada o‘z materiali chiqadi.
 */
const DEFAULT_ORDER_CODE = 'SR-2025-0708'

export const WORK_CHECKLIST: WorkChecklistItem[] = checklistFor(
  serviceRequestByCode(DEFAULT_ORDER_CODE) ?? { category: 'Elektr', progress: 0 },
)

export const WORK_MATERIALS: WorkMaterialLine[] = materialsFor(DEFAULT_ORDER_CODE)

// ---------------------------------------------------------------------------
// Material so‘rovlari: pozitsiya soni va summa material qatorlaridan hisoblanadi

export interface MaterialRequest {
  id: string
  code: string
  workOrder: string
  requester: string
  items: number
  amount: number
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'CANCELLED'
  createdAt: string
  buildingName: string
}

interface MaterialRequestSeed {
  id: string
  code: string
  workOrder: string
  requester: string
  status: MaterialRequest['status']
  createdAt: string
}

const MATERIAL_REQUEST_SEED: MaterialRequestSeed[] = [
  {
    id: 'mr-0098',
    code: 'MT-2025-0098',
    workOrder: 'SR-2025-0708',
    requester: 'Jasur Toshmatov',
    status: 'APPROVED',
    createdAt: '2025-05-15',
  },
  {
    id: 'mr-0097',
    code: 'MT-2025-0097',
    workOrder: 'SR-2025-0699',
    requester: 'Jasur Toshmatov',
    status: 'ISSUED',
    createdAt: '2025-05-11',
  },
  {
    id: 'mr-0096',
    code: 'MT-2025-0096',
    workOrder: 'SR-2025-0690',
    requester: 'Jasur Toshmatov',
    status: 'SUBMITTED',
    createdAt: '2025-05-09',
  },
  {
    // Ariza 08.05 da ochilgan, shuning uchun so‘rov undan oldin tuzilishi mumkin emas
    id: 'mr-0095',
    code: 'MT-2025-0095',
    workOrder: 'SR-2025-0703',
    requester: 'Jasur Toshmatov',
    status: 'ISSUED',
    createdAt: '2025-05-08',
  },
  {
    // Ariza 16.05 da ochilgan
    id: 'mr-0094',
    code: 'MT-2025-0094',
    workOrder: 'SR-2025-0684',
    requester: 'Jasur Toshmatov',
    status: 'REJECTED',
    createdAt: '2025-05-16',
  },
]

export const MATERIAL_REQUESTS: MaterialRequest[] = MATERIAL_REQUEST_SEED.map((seed) => {
  const lines = materialsFor(seed.workOrder)
  return {
    ...seed,
    items: lines.length,
    amount: lines.reduce((s, m) => s + m.qty * m.price, 0),
    buildingName: serviceRequestByCode(seed.workOrder)?.buildingName ?? '',
  }
})

// ---------------------------------------------------------------------------
// Ombor jamlanmasi

export interface WarehouseSummary {
  inbound: number
  outbound: number
  balance: number
  warehouses: number
  positions: number
  totalValue: number
}

/**
 * `inbound` reyestrdagi eng oxirgi qabul kunida kirim qilingan miqdor,
 * `outbound` esa berilgan (ISSUED) material so‘rovlari bo‘yicha chiqim.
 * `balance`, `positions` va `totalValue` to‘g‘ridan-to‘g‘ri jadvaldan
 * sanaladi, shuning uchun karta va jadval hech qachon ajralib qolmaydi.
 */
export function buildWarehouseSummary(
  list: StockItem[] = STOCK_ITEMS,
  requests: MaterialRequest[] = MATERIAL_REQUESTS,
): WarehouseSummary {
  const lastReceiptDay = list.reduce((d, i) => (i.addedAt > d ? i.addedAt : d), '')
  return {
    inbound: list.filter((i) => i.addedAt === lastReceiptDay).reduce((s, i) => s + i.qty, 0),
    outbound: requests
      .filter((r) => r.status === 'ISSUED')
      .reduce((s, r) => s + issueLinesFor(r.workOrder).reduce((q, l) => q + l.qty, 0), 0),
    balance: list.reduce((s, i) => s + i.qty, 0),
    warehouses: new Set(list.map((i) => i.warehouse)).size,
    positions: list.length,
    totalValue: list.reduce((s, i) => s + i.qty * i.price, 0),
  }
}

export const WAREHOUSE_SUMMARY: WarehouseSummary = buildWarehouseSummary()

// ---------------------------------------------------------------------------
// Hisoblagichlar
//
// O‘lchov birligi butun tizimda bitta yozuvda: kVt-soat, m³, ming m³, Gkal
// (billing tariflari bilan bir xil).

export interface Meter {
  id: string
  code: string
  type: 'Elektr' | 'Suv' | 'Gaz' | 'Issiqlik'
  serial: string
  buildingName: string
  location: string
  unit: string
  lastReading: number
  previousReading: number
  readAt: string
  verifyAt: string
  status: 'ACTIVE' | 'MAINTENANCE'
}

export const METERS: Meter[] = [
  {
    id: 'm-01',
    code: 'MTR-EL-0012',
    type: 'Elektr',
    serial: 'EL-884512',
    buildingName: 'Green Business Center',
    location: '5-qavat, elektr shchiti',
    unit: 'kVt-soat',
    lastReading: 125430,
    previousReading: 121540,
    readAt: '2026-08-15',
    verifyAt: '2027-03-01',
    status: 'ACTIVE',
  },
  {
    id: 'm-02',
    code: 'MTR-SV-0007',
    type: 'Suv',
    serial: 'SV-442108',
    buildingName: 'Green Business Center',
    location: 'Yerto‘la, suv tuguni',
    unit: 'm³',
    lastReading: 8760,
    previousReading: 8642,
    readAt: '2026-08-15',
    verifyAt: '2027-01-15',
    status: 'ACTIVE',
  },
  {
    id: 'm-03',
    code: 'MTR-GZ-0003',
    type: 'Gaz',
    serial: 'GZ-119045',
    buildingName: 'Mega Mall',
    location: 'Qozonxona',
    unit: 'ming m³',
    lastReading: 63.2,
    previousReading: 61.4,
    readAt: '2026-08-14',
    verifyAt: '2026-11-20',
    status: 'ACTIVE',
  },
  {
    id: 'm-04',
    code: 'MTR-IS-0005',
    type: 'Issiqlik',
    serial: 'IS-770231',
    buildingName: 'Harmony Residence',
    location: 'Issiqlik punkti',
    unit: 'Gkal',
    lastReading: 12340,
    previousReading: 12122,
    readAt: '2026-08-14',
    verifyAt: '2027-02-10',
    status: 'ACTIVE',
  },
  {
    // Qiyoslash muddati o‘tgan yagona hisoblagich, shu sababli ta’mirda turibdi
    id: 'm-05',
    code: 'MTR-EL-0021',
    type: 'Elektr',
    serial: 'EL-884590',
    buildingName: 'Urban Office',
    location: '3-qavat, elektr shchiti',
    unit: 'kVt-soat',
    lastReading: 74210,
    previousReading: 72880,
    readAt: '2026-08-13',
    verifyAt: '2026-07-30',
    status: 'MAINTENANCE',
  },
]

/** Qiyoslash muddati yaqin deb hisoblanadigan oraliq, kun */
export const VERIFY_SOON_DAYS = 60

/** Qiyoslash muddatigacha qolgan kun. Manfiy bo‘lsa muddat o‘tgan */
export function daysToVerification(meter: Meter, today: string = todayIso()): number {
  return daysBetween(today, meter.verifyAt)
}

export function isVerificationOverdue(meter: Meter, today: string = todayIso()): boolean {
  return daysToVerification(meter, today) < 0
}

export function isVerificationSoon(meter: Meter, today: string = todayIso()): boolean {
  const left = daysToVerification(meter, today)
  return left >= 0 && left <= VERIFY_SOON_DAYS
}

/** Jadvalda ko‘rsatiladigan holat: muddati o‘tgani statusdan ustun turadi */
export function meterStateLabel(meter: Meter, today: string = todayIso()): string {
  if (isVerificationOverdue(meter, today)) return 'Qiyoslash muddati o‘tgan'
  return meter.status === 'ACTIVE' ? 'Faol' : 'Ta’mirda'
}

export interface UtilitySummaryCard {
  label: string
  value: string
  unit: string
  delta: number
  icon: string
}

/** Karta yorlig‘i hisoblagich turiga bog‘langan: karta bosilsa jadval filtrlanadi */
const UTILITY_TYPES: Array<{ type: Meter['type']; label: string; icon: string }> = [
  { type: 'Elektr', label: 'Elektr energiyasi', icon: 'sparkle' },
  { type: 'Suv', label: 'Suv', icon: 'meter' },
  { type: 'Gaz', label: 'Gaz', icon: 'meter' },
  { type: 'Issiqlik', label: 'Issiqlik', icon: 'meter' },
]

/**
 * Kommunal KPI kartalari. Qiymat ham, o‘sish foizi ham hisoblagichlar
 * reyestridan olinadi, o‘lchov birligi esa jadvaldagi bilan bir xil yoziladi.
 */
export function buildUtilitySummary(list: Meter[] = METERS): UtilitySummaryCard[] {
  return UTILITY_TYPES.flatMap(({ type, label, icon }) => {
    const rows = list.filter((m) => m.type === type)
    const first = rows[0]
    if (!first) return []
    const last = rows.reduce((s, m) => s + m.lastReading, 0)
    const prev = rows.reduce((s, m) => s + m.previousReading, 0)
    const decimals = rows.every(
      (m) => Number.isInteger(m.lastReading) && Number.isInteger(m.previousReading),
    )
      ? 0
      : 1
    return [
      {
        label,
        value: num(last, decimals),
        unit: first.unit,
        delta: prev ? Math.round(((last - prev) / prev) * 1000) / 10 : 0,
        icon,
      },
    ]
  })
}

export const UTILITY_SUMMARY: UtilitySummaryCard[] = buildUtilitySummary()

// ---------------------------------------------------------------------------
// Bildirishnomalar
//
// Moliyaviy xabarlar buxgalteriya reyestridagi haqiqiy hisob-fakturalardan
// tuziladi: foydalanuvchi xabardagi hujjatni reyestrda albatta topadi,
// "necha kun qoldi" esa `dueAt` va bugungi sana farqidan hisoblanadi.

export interface AppNotification {
  id: string
  title: string
  body: string
  category: 'To‘lovlar' | 'Arizalar' | 'Servis' | 'Hujjatlar' | 'Tizim'
  at: string
  read: boolean
  icon: string
}

export interface InvoiceAlert {
  code: string
  tenant: string
  buildingName: string
  unitCode: string
  dueAt: string
  total: number
  /** To‘lanmagan qoldiq */
  debt: number
  /** Muddatgacha qolgan kun, manfiy bo‘lsa kechikish */
  daysLeft: number
}

function openInvoiceAlerts(today: string): InvoiceAlert[] {
  return INVOICES.filter(
    (i) => i.status !== 'CANCELLED' && i.status !== 'DRAFT' && i.total > i.paid,
  ).map((i) => ({
    code: i.code,
    tenant: i.tenant,
    buildingName: i.buildingName,
    unitCode: i.unitCode,
    dueAt: i.dueAt,
    total: i.total,
    debt: i.total - i.paid,
    daysLeft: daysBetween(today, i.dueAt),
  }))
}

/**
 * Ogohlantirishga tushadigan hisob-fakturalar:
 * `due` muddati eng yaqin to‘lanmagan hujjat (bo‘lmasa muddati eng kech o‘tgani),
 * `overdue` esa qarzi eng katta kechikkan hujjat.
 */
export function paymentAlerts(today: string = todayIso()): {
  due: InvoiceAlert | null
  overdue: InvoiceAlert | null
} {
  const open = openInvoiceAlerts(today)
  const upcoming = open.filter((i) => i.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft)
  const due = upcoming[0] ?? [...open].sort((a, b) => b.daysLeft - a.daysLeft)[0] ?? null
  const overdue =
    open
      .filter((i) => i.daysLeft < 0 && i.code !== due?.code)
      .sort((a, b) => b.debt - a.debt)[0] ?? null
  return { due, overdue }
}

export const PAYMENT_ALERTS = paymentAlerts()

function dueBody(a: InvoiceAlert): string {
  if (a.daysLeft > 0)
    return `${a.code} hisob-fakturasi bo‘yicha to‘lov muddatiga ${a.daysLeft} kun qoldi.`
  if (a.daysLeft === 0) return `${a.code} hisob-fakturasi bo‘yicha to‘lov muddati bugun tugaydi.`
  return `${a.code} hisob-fakturasi bo‘yicha to‘lov muddati ${dateShort(a.dueAt)} da tugagan, kechikish ${-a.daysLeft} kun.`
}

export function buildNotifications(today: string = todayIso()): AppNotification[] {
  const list: AppNotification[] = []
  const { due, overdue } = paymentAlerts(today)

  if (due) {
    list.push({
      id: 'n-01',
      title: due.daysLeft >= 0 ? 'To‘lov muddati yaqinlashdi' : 'To‘lov muddati o‘tdi',
      body: dueBody(due),
      category: 'To‘lovlar',
      at: 'Bugun 10:30',
      read: false,
      icon: 'wallet',
    })
  }

  if (overdue) {
    list.push({
      id: 'n-05',
      title: 'To‘lov kechikkanligi haqida ogohlantirish',
      body: `«${overdue.tenant}» bo‘yicha ${overdue.code} hisob-fakturasi ${num(overdue.debt)} so‘m qarz bilan ${-overdue.daysLeft} kundan beri to‘lanmagan.`,
      category: 'To‘lovlar',
      at: 'Bugun 09:40',
      read: true,
      icon: 'warning',
    })
  }

  list.push({
    id: 'n-06',
    title: 'Tizimga kirish: yangi qurilma',
    body: 'Profilingizga yangi qurilmadan kirildi: Chrome · Windows 11.',
    category: 'Tizim',
    at: 'Bugun 08:05',
    read: true,
    icon: 'shield',
  })

  list.push({
    // u-706 unit reyestrida VACANT holatida turibdi
    id: 'n-03',
    title: 'Yangi unit bo‘shadi',
    body: 'Green Business Center, 706-unit bo‘sh holatga o‘tdi va katalogda e’lon qilindi.',
    category: 'Arizalar',
    at: '18.05.2025 16:40',
    read: false,
    icon: 'building',
  })

  list.push({
    // MKON-2025-0155 shartnomasi REVIEW holatida, kelishilgan sanasi 15.05.2025
    id: 'n-04',
    title: 'Shartnoma Didox’da imzolanmoqda',
    body: 'MKON-2025-0155 shartnomasi Didox tizimiga yuborildi, imzo kutilmoqda.',
    category: 'Hujjatlar',
    at: '15.05.2025 14:22',
    read: true,
    icon: 'contract',
  })

  const finished = SERVICE_REQUESTS.find((r) => r.status === 'COMPLETED' && !!r.completedAt)
  if (finished?.completedAt) {
    list.push({
      id: 'n-02',
      title: 'Servis arizasi bajarildi',
      body: `${finished.code} «${finished.title}» arizasi bajarildi va tasdiqlashga yuborildi.`,
      category: 'Servis',
      at: `${dateShort(finished.completedAt)} ${finished.completedAt.slice(11)}`,
      read: false,
      icon: 'wrench',
    })
  }

  return list
}

export const NOTIFICATIONS: AppNotification[] = buildNotifications()

export interface NotificationCategoryCard {
  label: string
  count: number
}

const NOTIFICATION_CATEGORY_LABELS: AppNotification['category'][] = [
  'To‘lovlar',
  'Arizalar',
  'Servis',
  'Hujjatlar',
  'Tizim',
]

/** Yorliqlardagi son ro‘yxatdan sanaladi, «Barchasi» esa jami xabar soni */
export function buildNotificationCategories(
  list: AppNotification[] = NOTIFICATIONS,
): NotificationCategoryCard[] {
  return [
    { label: 'Barchasi', count: list.length },
    ...NOTIFICATION_CATEGORY_LABELS.map((label) => ({
      label,
      count: list.filter((n) => n.category === label).length,
    })),
  ]
}

export const NOTIFICATION_CATEGORIES: NotificationCategoryCard[] = buildNotificationCategories()
