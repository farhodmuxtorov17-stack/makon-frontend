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

export const CONTRACTS: Contract[] = [
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
    endsAt: '—',
    status: 'DRAFT',
    amount: 2450000000,
    paymentTerm: 'Bir martalik to‘lov',
    documents: [{ name: 'Sotuv shartnomasi loyihasi.pdf', size: '1.8 MB', type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2025-05-14', actor: 'Bobur Ismoilov', done: true },
      { label: 'Kelishildi', date: '—', actor: '—', done: false },
      { label: 'Imzolandi', date: '—', actor: '—', done: false },
      { label: 'Faollashdi', date: '—', actor: '—', done: false },
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
      { label: 'Imzolandi', date: '—', actor: '—', done: false },
      { label: 'Faollashdi', date: '—', actor: '—', done: false },
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
]

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

export const INVOICES: Invoice[] = [
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
]

export const BILLING_SUMMARY = {
  period: 'May 2025',
  charged: 128350000,
  discounts: 5850000,
  vat: 14925000,
  total: 137425000,
  paidTotal: 78890000,
  debtTotal: 46960000,
  overdueTotal: 18675000,
}

export const AGING = [
  { bucket: '0–30 kun', share: 28, amount: 13150000, tone: 'ok' as const },
  { bucket: '31–60 kun', share: 24, amount: 11265000, tone: 'brand' as const },
  { bucket: '61–90 kun', share: 8, amount: 3870000, tone: 'warn' as const },
  { bucket: '90+ kun', share: 40, amount: 18675000, tone: 'danger' as const },
]

export const PAYMENT_STATUS_BREAKDOWN = [
  { label: 'To‘langan', count: 78, share: 61, amount: 83520000, tone: 'ok' as const },
  { label: 'Qisman to‘langan', count: 21, share: 16, amount: 23150000, tone: 'warn' as const },
  { label: 'Tasdiqlangan', count: 15, share: 12, amount: 12845000, tone: 'brand' as const },
  { label: 'Kechikkan', count: 14, share: 11, amount: 18675000, tone: 'danger' as const },
]

export const TARIFF_LINES = [
  { service: 'Elektr energiyasi', unit: 'kVt-soat', tariff: 1250, qty: 4800, sum: 6000000 },
  { service: 'Suv ta’minoti', unit: 'm³', tariff: 9000, qty: 120, sum: 1080000 },
  { service: 'Issiqlik ta’minoti', unit: 'Gkal', tariff: 160000, qty: 8, sum: 1280000 },
  { service: 'Boshqaruv xizmati', unit: 'm²', tariff: 3000, qty: 200, sum: 600000 },
  { service: 'Tozalash xizmati', unit: 'm²', tariff: 2000, qty: 200, sum: 400000 },
]

// ---------------------------------------------------------------------------

export interface Application {
  id: string
  code: string
  tenant: string
  buildingName: string
  unitCode: string
  area: number
  type: 'Ijaraga olish' | 'Sotib olish'
  price: number
  stage: 'Bino rahbari' | 'Buxgalter' | 'Yakuniy'
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'BUILDING_REVIEW'
    | 'FINANCE_REVIEW'
    | 'OFFER_SENT'
    | 'APPROVED'
    | 'REJECTED'
    | 'COMPLETED'
  submittedAt: string
  contactPerson: string
  phone: string
  note: string
}

export const APPLICATIONS: Application[] = [
  {
    id: 'a-0156',
    code: 'ARZ-2025-0156',
    tenant: 'Makon Solutions MCHJ',
    buildingName: 'Green Business Center',
    unitCode: '704',
    area: 58.6,
    type: 'Ijaraga olish',
    price: 10900000,
    stage: 'Bino rahbari',
    status: 'BUILDING_REVIEW',
    submittedAt: '2025-05-12 10:30',
    contactPerson: 'Dilshod Ergashev',
    phone: '+998 90 567 89 01',
    note: 'Uch yillik muddatga ijaraga olmoqchimiz, dastlabki ko‘rikni tashkil qilishingizni so‘raymiz.',
  },
  {
    id: 'a-0155',
    code: 'ARZ-2025-0155',
    tenant: 'Tech Solutions UZB MChJ',
    buildingName: 'Mega Mall',
    unitCode: '301',
    area: 142.5,
    type: 'Ijaraga olish',
    price: 18500000,
    stage: 'Buxgalter',
    status: 'FINANCE_REVIEW',
    submittedAt: '2025-05-11 14:05',
    contactPerson: 'Sanjar Aliyev',
    phone: '+998 90 771 22 33',
    note: 'Savdo nuqtasi ochish rejalashtirilgan. To‘lov shartlarini muhokama qilishni so‘raymiz.',
  },
  {
    id: 'a-0154',
    code: 'ARZ-2025-0154',
    tenant: 'Mega Invest Group',
    buildingName: 'Industrial Park 2',
    unitCode: 'B-14',
    area: 620.0,
    type: 'Sotib olish',
    price: 31000000,
    stage: 'Bino rahbari',
    status: 'SUBMITTED',
    submittedAt: '2025-05-10 09:20',
    contactPerson: 'Aziz Nazarov',
    phone: '+998 90 882 44 55',
    note: 'Logistika markazi uchun ombor maydoni kerak.',
  },
  {
    id: 'a-0153',
    code: 'ARZ-2025-0153',
    tenant: 'Creative Agency',
    buildingName: 'Green Business Center',
    unitCode: '706',
    area: 61.3,
    type: 'Ijaraga olish',
    price: 11200000,
    stage: 'Yakuniy',
    status: 'APPROVED',
    submittedAt: '2025-05-06 16:40',
    contactPerson: 'Kamola Yusupova',
    phone: '+998 90 993 66 77',
    note: 'Joriy ofisdan kengaytirish maqsadida qo‘shimcha maydon.',
  },
  {
    id: 'a-0152',
    code: 'ARZ-2025-0152',
    tenant: 'Alpha Solutions',
    buildingName: 'Urban Office',
    unitCode: '402',
    area: 74.2,
    type: 'Ijaraga olish',
    price: 13400000,
    stage: 'Bino rahbari',
    status: 'REJECTED',
    submittedAt: '2025-05-04 11:15',
    contactPerson: 'Rustam Qodirov',
    phone: '+998 90 445 88 99',
    note: 'Talab qilingan muddat bo‘sh maydon rejasiga to‘g‘ri kelmadi.',
  },
]
