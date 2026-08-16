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

export const SERVICE_KPI = {
  newCount: 12,
  inProgress: 18,
  completedToday: 24,
  avgHours: 5.6,
  breakdown: [
    { label: 'Yangi', count: 12, share: 17, tone: 'brand' as const },
    { label: 'Jarayonda', count: 18, share: 25, tone: 'warn' as const },
    { label: 'Bajarilgan', count: 24, share: 33, tone: 'ok' as const },
    { label: 'Yopilgan', count: 18, share: 25, tone: 'neutral' as const },
  ],
}

export const WORK_CHECKLIST = [
  { label: 'Materiallar sifatini tekshirish', done: true },
  { label: 'O‘rnatish ishlari', done: true },
  { label: 'Ulanish va sinov', done: true },
  { label: 'Yoritish darajasi o‘lchovi', done: false },
  { label: 'Tozalash va ish joyini topshirish', done: false },
]

export const WORK_MATERIALS = [
  { name: 'LED armatura 60W', qty: 24, unit: 'dona', price: 320000 },
  { name: 'Elektr kabel NYM 3x1.5', qty: 180, unit: 'metr', price: 18000 },
  { name: 'Avtomat 1P 10A', qty: 12, unit: 'dona', price: 95000 },
]

// ---------------------------------------------------------------------------

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
]

export const STOCK_CATEGORIES = [
  { label: 'Mebel', icon: 'box', count: 42 },
  { label: 'Elektr jihozlar', icon: 'sparkle', count: 36 },
  { label: 'Sanitariya', icon: 'wrench', count: 28 },
  { label: 'Qurilish', icon: 'layers', count: 56 },
  { label: 'IT jihozlar', icon: 'cube', count: 18 },
  { label: 'Boshqalar', icon: 'clipboard', count: 68 },
]

export const WAREHOUSE_SUMMARY = {
  inbound: 120,
  outbound: 96,
  balance: 1284,
  warehouses: 3,
  positions: 248,
  totalValue: 1245500000,
}

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

export const MATERIAL_REQUESTS: MaterialRequest[] = [
  {
    id: 'mr-0098',
    code: 'MT-2025-0098',
    workOrder: 'SR-2025-0708',
    requester: 'Jasur Toshmatov',
    items: 3,
    amount: 12540000,
    status: 'APPROVED',
    createdAt: '2025-05-15',
    buildingName: 'Green Business Center',
  },
  {
    id: 'mr-0097',
    code: 'MT-2025-0097',
    workOrder: 'SR-2025-0699',
    requester: 'Jasur Toshmatov',
    items: 5,
    amount: 8320000,
    status: 'ISSUED',
    createdAt: '2025-05-11',
    buildingName: 'Harmony Residence',
  },
  {
    id: 'mr-0096',
    code: 'MT-2025-0096',
    workOrder: 'SR-2025-0690',
    requester: 'Jasur Toshmatov',
    items: 2,
    amount: 3150000,
    status: 'SUBMITTED',
    createdAt: '2025-05-09',
    buildingName: 'Urban Office',
  },
  {
    id: 'mr-0095',
    code: 'MT-2025-0095',
    workOrder: 'SR-2025-0703',
    requester: 'Jasur Toshmatov',
    items: 4,
    amount: 6740000,
    status: 'ISSUED',
    createdAt: '2025-05-06',
    buildingName: 'Mega Mall',
  },
  {
    id: 'mr-0094',
    code: 'MT-2025-0094',
    workOrder: 'SR-2025-0684',
    requester: 'Jasur Toshmatov',
    items: 1,
    amount: 1360000,
    status: 'REJECTED',
    createdAt: '2025-05-03',
    buildingName: 'Green Business Center',
  },
]

// ---------------------------------------------------------------------------

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
    readAt: '2025-05-18',
    verifyAt: '2026-03-01',
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
    readAt: '2025-05-18',
    verifyAt: '2026-01-15',
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
    readAt: '2025-05-17',
    verifyAt: '2025-11-20',
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
    readAt: '2025-05-17',
    verifyAt: '2026-02-10',
    status: 'ACTIVE',
  },
  {
    id: 'm-05',
    code: 'MTR-EL-0021',
    type: 'Elektr',
    serial: 'EL-884590',
    buildingName: 'Urban Office',
    location: '3-qavat, elektr shchiti',
    unit: 'kVt-soat',
    lastReading: 74210,
    previousReading: 72880,
    readAt: '2025-05-16',
    verifyAt: '2025-09-30',
    status: 'MAINTENANCE',
  },
]

export const UTILITY_SUMMARY = [
  { label: 'Elektr energiyasi', value: '125 430', unit: 'kWh', delta: 3.2, icon: 'sparkle' },
  { label: 'Suv', value: '8 760', unit: 'm³', delta: -1.1, icon: 'meter' },
  { label: 'Gaz', value: '63.2', unit: 'ming m³', delta: 2.5, icon: 'meter' },
  { label: 'Issiqlik', value: '12 340', unit: 'Gcal', delta: 1.8, icon: 'meter' },
]

// ---------------------------------------------------------------------------

export interface AppNotification {
  id: string
  title: string
  body: string
  category: 'To‘lovlar' | 'Arizalar' | 'Servis' | 'Hujjatlar' | 'Tizim'
  at: string
  read: boolean
  icon: string
}

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n-01',
    title: 'To‘lov muddati yaqinlashdi',
    body: 'INV-2025-0621 hisob-fakturasi bo‘yicha to‘lov muddatiga 3 kun qoldi.',
    category: 'To‘lovlar',
    at: 'Bugun 10:30',
    read: false,
    icon: 'wallet',
  },
  {
    id: 'n-02',
    title: 'Servis arizasi bajarildi',
    body: 'SR-2025-0703 «Santexnika montaj ishlari» arizasi bajarildi va tasdiqlashga yuborildi.',
    category: 'Servis',
    at: 'Bugun 09:15',
    read: false,
    icon: 'wrench',
  },
  {
    id: 'n-03',
    title: 'Yangi unit bo‘shadi',
    body: 'Green Business Center, 706-unit bo‘sh holatga o‘tdi va katalogda e’lon qilindi.',
    category: 'Arizalar',
    at: 'Kecha 16:40',
    read: false,
    icon: 'building',
  },
  {
    id: 'n-04',
    title: 'Shartnoma tasdiqlashda',
    body: 'MKON-2025-0155 shartnomasi tasdiqlash uchun yuborildi va javob kutmoqda.',
    category: 'Hujjatlar',
    at: 'Kecha 14:22',
    read: true,
    icon: 'contract',
  },
  {
    id: 'n-05',
    title: 'To‘lov kechikkanligi haqida ogohlantirish',
    body: 'Dream Retail bo‘yicha INV-2025-0584 hisob-fakturasi 61 kundan beri to‘lanmagan.',
    category: 'To‘lovlar',
    at: '19.05.2025',
    read: true,
    icon: 'warning',
  },
  {
    id: 'n-06',
    title: 'Tizimga kirish: yangi qurilma',
    body: 'Hisobingizga yangi qurilmadan kirildi: Chrome · Windows 11.',
    category: 'Tizim',
    at: '19.05.2025',
    read: true,
    icon: 'shield',
  },
]

export const NOTIFICATION_CATEGORIES = [
  { label: 'Barchasi', count: 24 },
  { label: 'To‘lovlar', count: 8 },
  { label: 'Arizalar', count: 6 },
  { label: 'Servis', count: 4 },
  { label: 'Hujjatlar', count: 3 },
  { label: 'Tizim', count: 3 },
]
