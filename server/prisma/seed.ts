/**
 * Boshlang‘ich ma’lumotlar: frontenddagi `app/data/*.ts` fayllarining aynan
 * nusxasi. Identifikatorlar ham bir xil saqlanadi, shuning uchun interfeysni
 * API ga ulaganda ro‘yxatlar, kodlar va ko‘rsatkichlar o‘zgarmaydi.
 *
 * Ishga tushirish: `npm run seed`.
 * Parol `SEED_DEFAULT_PASSWORD` muhit o‘zgaruvchisidan olinadi, kodda parol
 * saqlanmaydi.
 */
import { hash } from '@node-rs/argon2'
import {
  ContractStatus,
  DocumentKind,
  InvoiceStatus,
  LeaseStatus,
  ListingStatus,
  MaterialStatus,
  MeterStatus,
  OrganizationKind,
  PrismaClient,
  Prisma,
  Role,
  ScheduleKind,
  SchedulePeriodStatus,
  ServiceStatus,
  StockMovementKind,
  UnitStatus,
  WorkOrderStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

const D = (value: number) => new Prisma.Decimal(value)
const date = (value: string) => new Date(`${value}T00:00:00.000Z`)
const stamp = (value: string) => new Date(`${value.replace(' ', 'T')}:00.000Z`)

// ---------------------------------------------------------------------------
// Obyektlar

const BUILDINGS = [
  {
    id: 'b-01',
    code: 'BIN-0001',
    name: 'Green Business Center',
    slug: 'green-business-center',
    type: 'Biznes markaz',
    city: 'Toshkent',
    district: 'Mirobod tumani',
    street: 'Amir Temur ko‘chasi 88',
    buildYear: 2022,
    buildingClass: 'A klass',
    floors: 12,
    undergroundFloors: 2,
    unitCount: 192,
    occupiedUnits: 177,
    vacantUnits: 15,
    gla: 120000,
    vacantArea: 9600,
    occupancy: 92,
    monthlyRevenue: 3420000000,
    debt: 18200000,
    sla: 97,
    serviceRequestCount: 42,
    lat: 41.3167,
    lon: 69.2833,
    photo: 'green-business-center',
    gallery: [
      'green-business-center',
      'green-business-center-2',
      'green-business-center-3',
      'interior-office',
    ],
    managerId: 'u-002',
    managerName: 'Sardor Yo‘ldoshev',
    managerPhone: '+998 90 234 56 78',
    amenities: [
      '24/7 qo‘riqlash',
      'Yuqori tezlikdagi internet',
      'Markaziy isitish va sovitish',
      'Zamonaviy liftlar',
      'Yong‘inga qarshi tizim',
    ],
    equipment: ['Lift (4)', 'Generator', 'Yong‘in signalizatsiyasi', 'Suv nasosi', 'CCTV'],
  },
  {
    id: 'b-02',
    code: 'BIN-0002',
    name: 'Mega Mall',
    slug: 'mega-mall',
    type: 'Savdo markaz',
    city: 'Toshkent',
    district: 'Chilonzor tumani',
    street: 'Bunyodkor shoh ko‘chasi 3',
    buildYear: 2021,
    buildingClass: 'A klass',
    floors: 6,
    undergroundFloors: 1,
    unitCount: 148,
    occupiedUnits: 130,
    vacantUnits: 18,
    gla: 98500,
    vacantArea: 11820,
    occupancy: 88,
    monthlyRevenue: 2810000000,
    debt: 22500000,
    sla: 95,
    serviceRequestCount: 36,
    lat: 41.2756,
    lon: 69.2036,
    photo: 'mega-mall',
    gallery: ['mega-mall', 'mega-mall-2', 'mega-mall-3', 'mega-mall-4'],
    managerId: null,
    managerName: 'Dilshod Karimov',
    managerPhone: '+998 90 311 22 33',
    amenities: [
      '24/7 qo‘riqlash',
      'Yer usti parkovka',
      'Markaziy sovitish',
      'Eskalatorlar',
      'Yong‘inga qarshi tizim',
    ],
    equipment: ['Lift (6)', 'Eskalator (8)', 'Generator', 'CCTV', 'Havo tozalash tizimi'],
  },
  {
    id: 'b-03',
    code: 'BIN-0003',
    name: 'Industrial Park 2',
    slug: 'industrial-park-2',
    type: 'Ombor / logistika',
    city: 'Toshkent viloyati',
    district: 'Yuqori Chirchiq tumani',
    street: 'Sanoat ko‘chasi 12',
    buildYear: 2020,
    buildingClass: 'B klass',
    floors: 3,
    undergroundFloors: 0,
    unitCount: 64,
    occupiedUnits: 54,
    vacantUnits: 10,
    gla: 75000,
    vacantArea: 12000,
    occupancy: 84,
    monthlyRevenue: 1920000000,
    debt: 27400000,
    sla: 96,
    serviceRequestCount: 24,
    lat: 41.26,
    lon: 69.59,
    photo: 'industrial-park-2',
    gallery: ['industrial-park-2', 'industrial-park-2-2', 'industrial-park-2-3'],
    managerId: null,
    managerName: 'Bobur Ismoilov',
    managerPhone: '+998 90 422 55 66',
    amenities: [
      'Yuk ko‘taruvchi platformalar',
      'Kran tizimi',
      '24/7 qo‘riqlash',
      'Yong‘inga qarshi tizim',
      'Katta yuk avtomobillari uchun yo‘l',
    ],
    equipment: ['Yuk lifti (2)', 'Generator', 'Kran (4)', 'CCTV', 'Yong‘in gidranti'],
  },
  {
    id: 'b-04',
    code: 'BIN-0004',
    name: 'Harmony Residence',
    slug: 'harmony-residence',
    type: 'Turar joy',
    city: 'Toshkent',
    district: 'Yakkasaroy tumani',
    street: 'Shota Rustaveli ko‘chasi 45',
    buildYear: 2023,
    buildingClass: 'A klass',
    floors: 16,
    undergroundFloors: 2,
    unitCount: 128,
    occupiedUnits: 106,
    vacantUnits: 22,
    gla: 80000,
    vacantArea: 13600,
    occupancy: 83,
    monthlyRevenue: 2280000000,
    debt: 31600000,
    sla: 94,
    serviceRequestCount: 30,
    lat: 41.2831,
    lon: 69.25,
    photo: 'harmony-residence',
    gallery: ['harmony-residence'],
    managerId: null,
    managerName: 'Nigora Aripova',
    managerPhone: '+998 90 533 77 88',
    amenities: [
      '24/7 qo‘riqlash',
      'Yer osti parkovka',
      'Bolalar maydonchasi',
      'Fitnes zal',
      'Markaziy isitish',
    ],
    equipment: ['Lift (4)', 'Generator', 'Yong‘in signalizatsiyasi', 'Suv nasosi', 'CCTV'],
  },
  {
    id: 'b-05',
    code: 'BIN-0005',
    name: 'Urban Office',
    slug: 'urban-office',
    type: 'Ofis binosi',
    city: 'Toshkent',
    district: 'Yunusobod tumani',
    street: 'Abdulla Qodiriy ko‘chasi 10',
    buildYear: 2019,
    buildingClass: 'B+ klass',
    floors: 8,
    undergroundFloors: 1,
    unitCount: 96,
    occupiedUnits: 77,
    vacantUnits: 19,
    gla: 51900,
    vacantArea: 8256,
    occupancy: 80,
    monthlyRevenue: 2110000000,
    debt: 25700000,
    sla: 95,
    serviceRequestCount: 24,
    lat: 41.345,
    lon: 69.287,
    photo: 'urban-office',
    gallery: ['urban-office', 'urban-office-2', 'urban-office-3', 'urban-office-4'],
    managerId: null,
    managerName: 'Otabek Rahimov',
    managerPhone: '+998 90 644 99 00',
    amenities: [
      '24/7 qo‘riqlash',
      'Yuqori tezlikdagi internet',
      'Konferens zal',
      'Yer usti parkovka',
      'Markaziy isitish',
    ],
    equipment: ['Lift (3)', 'Generator', 'Yong‘in signalizatsiyasi', 'CCTV'],
  },
]

// ---------------------------------------------------------------------------
// Unitlar

const rect = (x: number, y: number, w: number, h: number) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]

interface UnitSeed {
  id: string
  code: string
  buildingId: string
  floor: number
  rooms: number
  area: number
  usage: string
  offer: string
  status: UnitStatus
  price: number
  priceUnit: string
  tenant?: string
  contractCode?: string
  equipment: string[]
  polygon: number[][]
}

const UNITS: UnitSeed[] = [
  { id: 'u-701', code: '701', buildingId: 'b-01', floor: 7, rooms: 3, area: 86.4, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.RENTED, price: 15200000, priceUnit: 'so‘m / oy', tenant: 'Tech Solutions UZB MChJ', contractCode: 'MKON-2025-0157', equipment: ['Konditsioner', 'Yong‘in datchigi', 'Internet chiqishi'], polygon: rect(0.06, 0.1, 0.19, 0.3) },
  { id: 'u-702', code: '702', buildingId: 'b-01', floor: 7, rooms: 2, area: 64.2, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.VACANT, price: 11800000, priceUnit: 'so‘m / oy', equipment: ['Konditsioner', 'Yong‘in datchigi'], polygon: rect(0.27, 0.1, 0.16, 0.3) },
  { id: 'u-703', code: '703', buildingId: 'b-01', floor: 7, rooms: 4, area: 112.8, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.RENTED, price: 19600000, priceUnit: 'so‘m / oy', tenant: 'FinTech Services', contractCode: 'MKON-2025-0154', equipment: ['Konditsioner', 'Yong‘in datchigi', 'Internet chiqishi', 'Serverxona'], polygon: rect(0.45, 0.1, 0.22, 0.3) },
  { id: 'u-704', code: '704', buildingId: 'b-01', floor: 7, rooms: 2, area: 58.6, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.RESERVED, price: 10900000, priceUnit: 'so‘m / oy', tenant: 'Makon Solutions MCHJ', equipment: ['Konditsioner', 'Yong‘in datchigi'], polygon: rect(0.69, 0.1, 0.16, 0.3) },
  { id: 'u-705', code: '705', buildingId: 'b-01', floor: 7, rooms: 3, area: 94.5, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.RENTED, price: 16800000, priceUnit: 'so‘m / oy', tenant: 'Creative Agency', contractCode: 'MKON-2025-0149', equipment: ['Konditsioner', 'Yong‘in datchigi', 'Internet chiqishi'], polygon: rect(0.06, 0.62, 0.19, 0.28) },
  { id: 'u-706', code: '706', buildingId: 'b-01', floor: 7, rooms: 2, area: 61.3, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.VACANT, price: 11200000, priceUnit: 'so‘m / oy', equipment: ['Konditsioner', 'Yong‘in datchigi'], polygon: rect(0.27, 0.62, 0.16, 0.28) },
  { id: 'u-707', code: '707', buildingId: 'b-01', floor: 7, rooms: 3, area: 78.9, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.MAINTENANCE, price: 14100000, priceUnit: 'so‘m / oy', equipment: ['Konditsioner', 'Yong‘in datchigi'], polygon: rect(0.45, 0.62, 0.22, 0.28) },
  { id: 'u-708', code: '708', buildingId: 'b-01', floor: 7, rooms: 5, area: 125.4, usage: 'Ofis', offer: 'Sotuv', status: UnitStatus.SOLD, price: 22940000, priceUnit: 'so‘m / m²', tenant: '«Grand Trade» MCHJ', contractCode: 'MKON-2025-0158', equipment: ['Konditsioner', 'Yong‘in datchigi', 'Internet chiqishi', 'Serverxona', 'Alohida sanuzel'], polygon: rect(0.69, 0.62, 0.16, 0.28) },
  { id: 'u-505', code: '505', buildingId: 'b-01', floor: 5, rooms: 8, area: 425.4, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.VACANT, price: 74445000, priceUnit: 'so‘m / oy', equipment: ['Markaziy konditsioner', 'Yong‘in o‘chirish tizimi', 'Optik internet', 'Alohida serverxona', 'Ikkita sanuzel'], polygon: rect(0.06, 0.1, 0.36, 0.34) },
  { id: 'u-506', code: '506', buildingId: 'b-01', floor: 5, rooms: 10, area: 612.3, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.VACANT, price: 104091000, priceUnit: 'so‘m / oy', equipment: ['Markaziy konditsioner', 'Yong‘in o‘chirish tizimi', 'Optik internet', 'Konferens zal', 'Ikkita sanuzel'], polygon: rect(0.46, 0.1, 0.39, 0.34) },
  { id: 'u-501', code: '501', buildingId: 'b-01', floor: 5, rooms: 4, area: 148.2, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.RENTED, price: 25900000, priceUnit: 'so‘m / oy', tenant: 'Urban Office MCHJ', contractCode: 'MKON-2025-0161', equipment: ['Konditsioner', 'Yong‘in datchigi', 'Internet chiqishi'], polygon: rect(0.06, 0.56, 0.24, 0.34) },
  { id: 'u-502', code: '502', buildingId: 'b-01', floor: 5, rooms: 6, area: 214.6, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.RENTED, price: 12540000, priceUnit: 'so‘m / oy', tenant: 'Urban Office LLC', contractCode: 'MKON-2025-0158', equipment: ['Konditsioner', 'Yong‘in datchigi', 'Internet chiqishi', 'Oshxona'], polygon: rect(0.34, 0.56, 0.28, 0.34) },
  { id: 'u-503', code: '503', buildingId: 'b-01', floor: 5, rooms: 3, area: 96.8, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.RENTED, price: 17400000, priceUnit: 'so‘m / oy', tenant: 'Global Logistics & Trans', contractCode: 'MKON-2025-0155', equipment: ['Konditsioner', 'Yong‘in datchigi'], polygon: rect(0.66, 0.56, 0.19, 0.34) },
  { id: 'u-204', code: '204', buildingId: 'b-02', floor: 2, rooms: 1, area: 85.0, usage: 'Savdo', offer: 'Ijara', status: UnitStatus.RENTED, price: 12000000, priceUnit: 'so‘m / m²', tenant: 'Dream Retail', contractCode: 'MKON-2025-0152', equipment: ['Konditsioner', 'Vitrina yoritgichi', 'Yong‘in datchigi'], polygon: rect(0.08, 0.12, 0.26, 0.32) },
  { id: 'u-301', code: '301', buildingId: 'b-02', floor: 3, rooms: 2, area: 142.5, usage: 'Savdo', offer: 'Ijara', status: UnitStatus.VACANT, price: 18500000, priceUnit: 'so‘m / oy', equipment: ['Konditsioner', 'Vitrina yoritgichi'], polygon: rect(0.38, 0.12, 0.3, 0.32) },
  { id: 'u-b12', code: 'B-12', buildingId: 'b-03', floor: 1, rooms: 1, area: 450.0, usage: 'Ombor', offer: 'Sotuv', status: UnitStatus.RESERVED, price: 24000000, priceUnit: 'so‘m / oy', tenant: 'Mega Invest Group', equipment: ['Yuk platformasi', 'Kran', 'Yong‘in gidranti'], polygon: rect(0.08, 0.14, 0.38, 0.34) },
  { id: 'u-b14', code: 'B-14', buildingId: 'b-03', floor: 1, rooms: 1, area: 620.0, usage: 'Ombor', offer: 'Ijara', status: UnitStatus.VACANT, price: 31000000, priceUnit: 'so‘m / oy', equipment: ['Yuk platformasi', 'Kran'], polygon: rect(0.5, 0.14, 0.42, 0.34) },
  { id: 'u-a502', code: 'A-502', buildingId: 'b-04', floor: 5, rooms: 4, area: 120.0, usage: 'Turar joy', offer: 'Sotuv', status: UnitStatus.RENTED, price: 1250000, priceUnit: 'so‘m / m²', tenant: 'Global Logistics & Trans', contractCode: 'MKON-2025-0155', equipment: ['Konditsioner', 'Balkon', 'Yong‘in datchigi'], polygon: rect(0.08, 0.12, 0.3, 0.34) },
  { id: 'u-a604', code: 'A-604', buildingId: 'b-04', floor: 6, rooms: 3, area: 98.4, usage: 'Turar joy', offer: 'Sotuv', status: UnitStatus.VACANT, price: 1250000, priceUnit: 'so‘m / m²', equipment: ['Konditsioner', 'Balkon'], polygon: rect(0.42, 0.12, 0.28, 0.34) },
  { id: 'u-402', code: '402', buildingId: 'b-05', floor: 4, rooms: 3, area: 74.2, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.VACANT, price: 13400000, priceUnit: 'so‘m / oy', equipment: ['Konditsioner', 'Yong‘in datchigi', 'Internet chiqishi'], polygon: rect(0.07, 0.12, 0.24, 0.32) },
  { id: 'u-405', code: '405', buildingId: 'b-05', floor: 4, rooms: 2, area: 52.8, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.RENTED, price: 9600000, priceUnit: 'so‘m / oy', tenant: 'Alpha Solutions', equipment: ['Konditsioner', 'Yong‘in datchigi'], polygon: rect(0.35, 0.12, 0.2, 0.32) },
  { id: 'u-408', code: '408', buildingId: 'b-05', floor: 4, rooms: 4, area: 118.6, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.RENTED, price: 21300000, priceUnit: 'so‘m / oy', tenant: 'Beta Trade', contractCode: 'MKON-2025-0147', equipment: ['Konditsioner', 'Yong‘in datchigi', 'Internet chiqishi', 'Oshxona'], polygon: rect(0.59, 0.12, 0.28, 0.32) },
  { id: 'u-302', code: '302', buildingId: 'b-05', floor: 3, rooms: 2, area: 61.4, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.VACANT, price: 11100000, priceUnit: 'so‘m / oy', equipment: ['Konditsioner', 'Yong‘in datchigi'], polygon: rect(0.07, 0.56, 0.24, 0.32) },
  { id: 'u-305', code: '305', buildingId: 'b-05', floor: 3, rooms: 3, area: 88.2, usage: 'Ofis', offer: 'Ijara', status: UnitStatus.RENTED, price: 15800000, priceUnit: 'so‘m / oy', tenant: 'Gamma LLC', equipment: ['Konditsioner', 'Yong‘in datchigi', 'Internet chiqishi'], polygon: rect(0.35, 0.56, 0.28, 0.32) },
]

// ---------------------------------------------------------------------------
// Tashkilotlar

interface OrganizationSeed {
  id: string
  name: string
  kind: OrganizationKind
  tin: string | null
  director: string | null
  phone: string | null
  email: string | null
  address: string | null
  isLandlord?: boolean
}

const ORGANIZATIONS: OrganizationSeed[] = [
  {
    id: 'org-makon',
    name: 'Makon Property Group MCHJ',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '305 412 876',
    director: 'Azizbek Karimov',
    phone: '+998 78 150 00 00',
    email: 'info@makon.uz',
    address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
    isLandlord: true,
  },
  {
    id: 'org-servispro',
    name: 'Servis Pro MCHJ',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '308 774 512',
    director: 'Jasur Toshmatov',
    phone: '+998 90 456 78 90',
    email: 'info@servispro.uz',
    address: 'Toshkent shahri, Chilonzor tumani, Bunyodkor shoh ko‘chasi 3',
  },
  {
    id: 'org-urban-mchj',
    name: 'Urban Office MCHJ',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '307 219 645',
    director: 'Dilshod Ergashev',
    phone: '+998 90 567 89 01',
    email: 'd.ergashev@urbanoffice.uz',
    address: 'Toshkent shahri, Yunusobod tumani, Abdulla Qodiriy ko‘chasi 10',
  },
  {
    id: 'org-urban-llc',
    name: 'Urban Office LLC',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '307 219 646',
    director: 'Shohruh Ergashev',
    phone: '+998 90 567 89 02',
    email: 'office@urbanoffice.uz',
    address: 'Toshkent shahri, Yunusobod tumani, Abdulla Qodiriy ko‘chasi 10',
  },
  {
    id: 'org-tech',
    name: 'Tech Solutions UZB MChJ',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '304 552 118',
    director: 'Sanjar Aliyev',
    phone: '+998 90 771 22 33',
    email: 's.aliyev@techsolutions.uz',
    address: 'Toshkent shahri, Chilonzor tumani, Bunyodkor shoh ko‘chasi 3',
  },
  {
    id: 'org-dream',
    name: 'Dream Retail',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '301 774 208',
    director: 'Malika Sobirova',
    phone: '+998 90 220 11 44',
    email: 'info@dreamretail.uz',
    address: 'Toshkent shahri, Chilonzor tumani, Bunyodkor shoh ko‘chasi 3',
  },
  {
    id: 'org-global',
    name: 'Global Logistics & Trans',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '305 118 733',
    director: 'Ulug‘bek Sattorov',
    phone: '+998 90 331 55 66',
    email: 'info@globallogistics.uz',
    address: 'Toshkent shahri, Yakkasaroy tumani, Shota Rustaveli ko‘chasi 45',
  },
  {
    id: 'org-fintech',
    name: 'FinTech Services',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '306 440 219',
    director: 'Jamshid Yo‘ldoshev',
    phone: '+998 90 774 33 22',
    email: 'info@fintechservices.uz',
    address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
  },
  {
    id: 'org-megainvest',
    name: 'Mega Invest Group',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '302 640 973',
    director: 'Aziz Nazarov',
    phone: '+998 90 882 44 55',
    email: 'a.nazarov@megainvest.uz',
    address: 'Toshkent viloyati, Yuqori Chirchiq tumani, Sanoat ko‘chasi 12',
  },
  {
    id: 'org-creative',
    name: 'Creative Agency',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '303 981 264',
    director: 'Kamola Yusupova',
    phone: '+998 90 993 66 77',
    email: 'k.yusupova@creative.uz',
    address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
  },
  {
    id: 'org-alpha',
    name: 'Alpha Solutions',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '309 447 130',
    director: 'Rustam Qodirov',
    phone: '+998 90 445 88 99',
    email: 'r.qodirov@alpha.uz',
    address: 'Toshkent shahri, Yunusobod tumani, Abdulla Qodiriy ko‘chasi 10',
  },
  {
    id: 'org-makon-solutions',
    name: 'Makon Solutions MCHJ',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '306 118 402',
    director: 'Bekzod Sultonov',
    phone: '+998 90 512 30 40',
    email: 'info@makonsolutions.uz',
    address: 'Toshkent shahri, Mirobod tumani, Shahrisabz ko‘chasi 14',
  },
  {
    id: 'org-grand-trade',
    name: '«Grand Trade» MCHJ',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '304 220 815',
    director: 'Shavkat Hamroyev',
    phone: '+998 90 118 22 77',
    email: 'info@grandtrade.uz',
    address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
  },
  {
    id: 'org-beta',
    name: 'Beta Trade',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '308 119 552',
    director: 'Zafar Umarov',
    phone: '+998 90 660 12 34',
    email: 'info@betatrade.uz',
    address: 'Toshkent shahri, Yunusobod tumani, Abdulla Qodiriy ko‘chasi 10',
  },
  {
    id: 'org-gamma',
    name: 'Gamma LLC',
    kind: OrganizationKind.LEGAL_ENTITY,
    tin: '307 553 901',
    director: 'Nodira Ismoilova',
    phone: '+998 90 707 45 56',
    email: 'info@gamma.uz',
    address: 'Toshkent shahri, Yunusobod tumani, Abdulla Qodiriy ko‘chasi 10',
  },
]

// ---------------------------------------------------------------------------
// Foydalanuvchilar

interface UserSeed {
  id: string
  login: string
  fullName: string
  role: Role
  organizationId: string
  position: string
  phone: string
  email: string
  buildingScope: string[]
  warehouseScope: string[]
}

const USERS: UserSeed[] = [
  { id: 'u-001', login: 'a.karimov', fullName: 'Azizbek Karimov', role: Role.SUPER_HEAD, organizationId: 'org-makon', position: 'Bosh direktor', phone: '+998901234567', email: 'a.karimov@makon.uz', buildingScope: [], warehouseScope: [] },
  { id: 'u-002', login: 's.yuldoshev', fullName: 'Sardor Yo‘ldoshev', role: Role.BUILDING_MANAGER, organizationId: 'org-makon', position: 'Green Business Center rahbari', phone: '+998902345678', email: 's.yuldoshev@makon.uz', buildingScope: ['b-01'], warehouseScope: [] },
  { id: 'u-003', login: 'n.rahimova', fullName: 'Nilufar Rahimova', role: Role.ACCOUNTANT, organizationId: 'org-makon', position: 'Bosh buxgalter', phone: '+998903456789', email: 'n.rahimova@makon.uz', buildingScope: [], warehouseScope: [] },
  { id: 'u-004', login: 'j.toshmatov', fullName: 'Jasur Toshmatov', role: Role.FACILITY, organizationId: 'org-servispro', position: 'Xo‘jalik bo‘limi ustasi', phone: '+998904567890', email: 'j.toshmatov@servispro.uz', buildingScope: ['b-01', 'b-02'], warehouseScope: [] },
  { id: 'u-006', login: 'a.qodirov', fullName: 'Anvar Qodirov', role: Role.WAREHOUSE_OPERATOR, organizationId: 'org-makon', position: 'Markaziy ombor mudiri', phone: '+998906789012', email: 'a.qodirov@makon.uz', buildingScope: [], warehouseScope: ['w-01'] },
  { id: 'u-007', login: 'm.yusupova', fullName: 'Malika Yusupova', role: Role.CONTENT_OPERATOR, organizationId: 'org-makon', position: 'Kontent operatori', phone: '+998907890123', email: 'm.yusupova@makon.uz', buildingScope: ['b-01', 'b-02', 'b-05'], warehouseScope: [] },
  { id: 'u-005', login: '+998905678901', fullName: 'Dilshod Ergashev', role: Role.TENANT_OWNER, organizationId: 'org-urban-mchj', position: 'Direktor', phone: '+998905678901', email: 'd.ergashev@urbanoffice.uz', buildingScope: [], warehouseScope: [] },
  { id: 'u-008', login: '+998905123040', fullName: 'Bekzod Sultonov', role: Role.TENANT_OWNER, organizationId: 'org-makon-solutions', position: 'Direktor', phone: '+998905123040', email: 'info@makonsolutions.uz', buildingScope: [], warehouseScope: [] },
  { id: 'u-009', login: '+998907712233', fullName: 'Sanjar Aliyev', role: Role.TENANT_OWNER, organizationId: 'org-tech', position: 'Direktor', phone: '+998907712233', email: 's.aliyev@techsolutions.uz', buildingScope: [], warehouseScope: [] },
  { id: 'u-010', login: '+998908824455', fullName: 'Aziz Nazarov', role: Role.TENANT_OWNER, organizationId: 'org-megainvest', position: 'Direktor', phone: '+998908824455', email: 'a.nazarov@megainvest.uz', buildingScope: [], warehouseScope: [] },
  { id: 'u-011', login: '+998909936677', fullName: 'Kamola Yusupova', role: Role.TENANT_OWNER, organizationId: 'org-creative', position: 'Direktor', phone: '+998909936677', email: 'k.yusupova@creative.uz', buildingScope: [], warehouseScope: [] },
  { id: 'u-012', login: '+998904458899', fullName: 'Rustam Qodirov', role: Role.TENANT_OWNER, organizationId: 'org-alpha', position: 'Direktor', phone: '+998904458899', email: 'r.qodirov@alpha.uz', buildingScope: [], warehouseScope: [] },
]

// ---------------------------------------------------------------------------
// Shartnomalar

interface ContractSeed {
  id: string
  code: string
  type: string
  organizationId: string
  buildingId: string
  unitId: string
  unitCode: string
  startsAt: string
  endsAt: string | null
  status: ContractStatus
  amount: number
  paymentTerm: string
  documents: Array<{ name: string; size: number; type: string }>
  timeline: Array<{ label: string; date: string | null; actor: string; done: boolean }>
}

const CONTRACTS: ContractSeed[] = [
  {
    id: 'c-0161', code: 'MKON-2025-0161', type: 'Ijara', organizationId: 'org-urban-mchj', buildingId: 'b-01', unitId: 'u-501', unitCode: 'Unit 501',
    startsAt: '2025-04-02', endsAt: '2027-04-01', status: ContractStatus.ACTIVE, amount: 310800000, paymentTerm: 'Oylik oldindan to‘lov',
    documents: [
      { name: 'Ijara shartnomasi.pdf', size: 2202009, type: 'pdf' },
      { name: 'Jihozlar ro‘yxati dalolatnomasi.docx', size: 471040, type: 'docx' },
    ],
    timeline: [
      { label: 'Yaratildi', date: '2025-03-20', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2025-03-26', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-03-31', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-04-02', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0158', code: 'MKON-2025-0158', type: 'Ijara', organizationId: 'org-urban-llc', buildingId: 'b-01', unitId: 'u-708', unitCode: 'Unit 708',
    startsAt: '2025-05-18', endsAt: '2027-05-17', status: ContractStatus.ACTIVE, amount: 125400000, paymentTerm: 'Oylik oldindan to‘lov',
    documents: [
      { name: 'Ijara shartnomasi.pdf', size: 2516582, type: 'pdf' },
      { name: 'Qabul-topshirish akti.pdf', size: 1153434, type: 'pdf' },
      { name: 'To‘lov jadvali.xlsx', size: 348160, type: 'xlsx' },
    ],
    timeline: [
      { label: 'Yaratildi', date: '2025-05-08', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2025-05-12', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-05-16', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-05-18', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0157', code: 'MKON-2025-0157', type: 'Ijara', organizationId: 'org-tech', buildingId: 'b-02', unitId: 'u-204', unitCode: 'Unit 204',
    startsAt: '2025-04-01', endsAt: '2027-03-31', status: ContractStatus.ACTIVE, amount: 67200000, paymentTerm: 'Oylik oldindan to‘lov',
    documents: [
      { name: 'Ijara shartnomasi.pdf', size: 2202009, type: 'pdf' },
      { name: 'To‘lov jadvali.xlsx', size: 305152, type: 'xlsx' },
    ],
    timeline: [
      { label: 'Yaratildi', date: '2025-03-18', actor: 'Dilshod Karimov', done: true },
      { label: 'Kelishildi', date: '2025-03-24', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-03-29', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-04-01', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0156', code: 'MKON-2025-0156', type: 'Sotuv', organizationId: 'org-megainvest', buildingId: 'b-03', unitId: 'u-b12', unitCode: 'Unit B-12',
    startsAt: '2025-06-01', endsAt: null, status: ContractStatus.DRAFT, amount: 2450000000, paymentTerm: 'Bir martalik to‘lov',
    documents: [{ name: 'Sotuv shartnomasi loyihasi.pdf', size: 1887437, type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2025-05-14', actor: 'Bobur Ismoilov', done: true },
      { label: 'Kelishildi', date: null, actor: '-', done: false },
      { label: 'Imzolandi', date: null, actor: '-', done: false },
      { label: 'Faollashdi', date: null, actor: '-', done: false },
    ],
  },
  {
    id: 'c-0155', code: 'MKON-2025-0155', type: 'Ijara', organizationId: 'org-global', buildingId: 'b-04', unitId: 'u-a502', unitCode: 'Unit A-502',
    startsAt: '2025-05-25', endsAt: '2026-05-24', status: ContractStatus.REVIEW, amount: 89760000, paymentTerm: 'Choraklik to‘lov',
    documents: [{ name: 'Shartnoma loyihasi.pdf', size: 1677721, type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2025-05-11', actor: 'Nigora Aripova', done: true },
      { label: 'Kelishildi', date: '2025-05-15', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: null, actor: '-', done: false },
      { label: 'Faollashdi', date: null, actor: '-', done: false },
    ],
  },
  {
    id: 'c-0154', code: 'MKON-2025-0154', type: 'Ijara', organizationId: 'org-fintech', buildingId: 'b-01', unitId: 'u-703', unitCode: 'Unit 703',
    startsAt: '2023-05-01', endsAt: '2025-04-30', status: ContractStatus.EXPIRED, amount: 54000000, paymentTerm: 'Oylik oldindan to‘lov',
    documents: [{ name: 'Ijara shartnomasi.pdf', size: 2097152, type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2023-04-12', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2023-04-18', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2023-04-26', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2023-05-01', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0152', code: 'MKON-2025-0152', type: 'Ijara', organizationId: 'org-dream', buildingId: 'b-02', unitId: 'u-204', unitCode: 'Unit 204',
    startsAt: '2025-02-01', endsAt: '2028-01-31', status: ContractStatus.ACTIVE, amount: 94800000, paymentTerm: 'Oylik oldindan to‘lov',
    documents: [{ name: 'Ijara shartnomasi.pdf', size: 2306867, type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2025-01-14', actor: 'Dilshod Karimov', done: true },
      { label: 'Kelishildi', date: '2025-01-20', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-01-27', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-02-01', actor: 'Tizim', done: true },
    ],
  },
  {
    id: 'c-0149', code: 'MKON-2025-0149', type: 'Ijara', organizationId: 'org-creative', buildingId: 'b-01', unitId: 'u-705', unitCode: 'Unit 705',
    startsAt: '2025-03-01', endsAt: '2026-02-28', status: ContractStatus.ACTIVE, amount: 63600000, paymentTerm: 'Oylik oldindan to‘lov',
    documents: [{ name: 'Ijara shartnomasi.pdf', size: 1992294, type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2025-02-10', actor: 'Sardor Yo‘ldoshev', done: true },
      { label: 'Kelishildi', date: '2025-02-16', actor: 'Nilufar Rahimova', done: true },
      { label: 'Imzolandi', date: '2025-02-24', actor: 'Jahongir Alimov', done: true },
      { label: 'Faollashdi', date: '2025-03-01', actor: 'Tizim', done: true },
    ],
  },
]

// ---------------------------------------------------------------------------
// Hisob-fakturalar

interface InvoiceSeed {
  id: string
  code: string
  organizationId: string
  contractId: string | null
  buildingId: string
  unitId: string | null
  periodCode: string
  periodLabel: string
  issuedAt: string
  dueAt: string
  total: number
  paid: number
  status: InvoiceStatus
  agingBucket: string | null
  tenantName: string
  buildingName: string
  unitCode: string
}

const INVOICES: InvoiceSeed[] = [
  { id: 'i-0587', code: 'INV-2025-0587', organizationId: 'org-urban-llc', contractId: 'c-0158', buildingId: 'b-01', unitId: 'u-502', periodCode: '2025-05', periodLabel: 'May 2025', issuedAt: '2025-05-01', dueAt: '2025-05-10', total: 12540000, paid: 12540000, status: InvoiceStatus.PAID, agingBucket: null, tenantName: 'Urban Office LLC', buildingName: 'Green Business Center', unitCode: 'Unit 502' },
  { id: 'i-0586', code: 'INV-2025-0586', organizationId: 'org-tech', contractId: 'c-0157', buildingId: 'b-02', unitId: 'u-301', periodCode: '2025-05', periodLabel: 'May 2025', issuedAt: '2025-05-01', dueAt: '2025-05-10', total: 8760000, paid: 5200000, status: InvoiceStatus.PARTIALLY_PAID, agingBucket: '0-30', tenantName: 'Tech Solutions UZB MChJ', buildingName: 'Mega Mall', unitCode: 'Unit 301' },
  { id: 'i-0585', code: 'INV-2025-0585', organizationId: 'org-creative', contractId: 'c-0149', buildingId: 'b-01', unitId: 'u-705', periodCode: '2025-05', periodLabel: 'May 2025', issuedAt: '2025-05-01', dueAt: '2025-05-25', total: 5320000, paid: 0, status: InvoiceStatus.ISSUED, agingBucket: '0-30', tenantName: 'Creative Agency', buildingName: 'Green Business Center', unitCode: 'Unit 705' },
  { id: 'i-0584', code: 'INV-2025-0584', organizationId: 'org-dream', contractId: 'c-0152', buildingId: 'b-02', unitId: 'u-204', periodCode: '2025-03', periodLabel: 'Mart 2025', issuedAt: '2025-03-01', dueAt: '2025-03-10', total: 7890000, paid: 0, status: InvoiceStatus.OVERDUE, agingBucket: '61-90', tenantName: 'Dream Retail', buildingName: 'Mega Mall', unitCode: 'Unit 204' },
  { id: 'i-0583', code: 'INV-2025-0583', organizationId: 'org-global', contractId: 'c-0155', buildingId: 'b-04', unitId: 'u-a502', periodCode: '2025-04', periodLabel: 'Aprel 2025', issuedAt: '2025-04-01', dueAt: '2025-04-10', total: 9145000, paid: 4000000, status: InvoiceStatus.PARTIALLY_PAID, agingBucket: '31-60', tenantName: 'Global Logistics & Trans', buildingName: 'Harmony Residence', unitCode: 'Unit A-502' },
  { id: 'i-0582', code: 'INV-2025-0582', organizationId: 'org-fintech', contractId: 'c-0154', buildingId: 'b-01', unitId: 'u-703', periodCode: '2025-02', periodLabel: 'Fevral 2025', issuedAt: '2025-02-01', dueAt: '2025-02-10', total: 6480000, paid: 0, status: InvoiceStatus.OVERDUE, agingBucket: '90+', tenantName: 'FinTech Services', buildingName: 'Green Business Center', unitCode: 'Unit 703' },
  { id: 'i-0581', code: 'INV-2025-0581', organizationId: 'org-megainvest', contractId: 'c-0156', buildingId: 'b-03', unitId: 'u-b12', periodCode: '2025-05', periodLabel: 'May 2025', issuedAt: '2025-05-01', dueAt: '2025-05-20', total: 24000000, paid: 24000000, status: InvoiceStatus.PAID, agingBucket: null, tenantName: 'Mega Invest Group', buildingName: 'Industrial Park 2', unitCode: 'Unit B-12' },
  { id: 'i-0580', code: 'INV-2025-0580', organizationId: 'org-urban-mchj', contractId: 'c-0161', buildingId: 'b-01', unitId: 'u-501', periodCode: '2025-05', periodLabel: 'May 2025', issuedAt: '2025-05-01', dueAt: '2025-05-10', total: 25900000, paid: 25900000, status: InvoiceStatus.PAID, agingBucket: null, tenantName: 'Urban Office MCHJ', buildingName: 'Green Business Center', unitCode: 'Unit 501' },
]

/** Hisob-faktura satrlari, tarif jadvalidan. */
const TARIFF_LINES = [
  { service: 'Elektr energiyasi', unit: 'kVt-soat', tariff: 1250, qty: 4800, sum: 6000000 },
  { service: 'Suv ta’minoti', unit: 'm³', tariff: 9000, qty: 120, sum: 1080000 },
  { service: 'Issiqlik ta’minoti', unit: 'Gkal', tariff: 160000, qty: 8, sum: 1280000 },
  { service: 'Boshqaruv xizmati', unit: 'm²', tariff: 3000, qty: 200, sum: 600000 },
  { service: 'Tozalash xizmati', unit: 'm²', tariff: 2000, qty: 200, sum: 400000 },
]

// ---------------------------------------------------------------------------
// Servis arizalari

interface ServiceSeed {
  id: string
  code: string
  title: string
  category: string
  buildingId: string
  unitId: string | null
  organizationId: string | null
  unitCode: string
  requesterName: string
  priority: string
  status: ServiceStatus
  assigneeName: string | null
  createdAt: string
  dueAt: string
  slaBreached: boolean
  description: string
  progress: number
}

const SERVICE_REQUESTS: ServiceSeed[] = [
  { id: 's-0712', code: 'SR-2025-0712', title: 'Fasad bo‘yash ishlari', category: 'Qurilish', buildingId: 'b-01', unitId: null, organizationId: null, unitCode: 'Umumiy zona', requesterName: 'Sardor Yo‘ldoshev', priority: 'O‘rtacha', status: ServiceStatus.NEW, assigneeName: null, createdAt: '2025-05-18 08:40', dueAt: '2025-05-28', slaBreached: false, description: 'Bino old fasadining 1–3-qavat oralig‘idagi bo‘yoq qatlami ko‘chgan. Tozalash va qayta bo‘yash talab etiladi.', progress: 0 },
  { id: 's-0708', code: 'SR-2025-0708', title: 'Elektr yoritish o‘rnatish', category: 'Elektr', buildingId: 'b-01', unitId: null, organizationId: null, unitCode: '5-qavat, koridor', requesterName: 'Dilshod Ergashev', priority: 'Yuqori', status: ServiceStatus.IN_PROGRESS, assigneeName: 'Jasur Toshmatov', createdAt: '2025-05-14 11:20', dueAt: '2025-05-22', slaBreached: false, description: '5-qavat koridorida LED yoritish tizimini o‘rnatish, eski armaturalarni almashtirish va yoritish darajasini o‘lchash.', progress: 65 },
  { id: 's-0703', code: 'SR-2025-0703', title: 'Santexnika montaj ishlari', category: 'Santexnika', buildingId: 'b-02', unitId: 'u-204', organizationId: 'org-dream', unitCode: '204', requesterName: 'Dream Retail', priority: 'Yuqori', status: ServiceStatus.COMPLETED, assigneeName: 'Jasur Toshmatov', createdAt: '2025-05-08 09:05', dueAt: '2025-05-15', slaBreached: false, description: 'Sanuzeldagi quvur oqishini bartaraf etish va aralashtirgichni almashtirish.', progress: 100 },
  { id: 's-0699', code: 'SR-2025-0699', title: 'Hovli obodonlashtirish', category: 'Qurilish', buildingId: 'b-04', unitId: null, organizationId: null, unitCode: 'Umumiy zona', requesterName: 'Nigora Aripova', priority: 'Past', status: ServiceStatus.RETURNED, assigneeName: 'Jasur Toshmatov', createdAt: '2025-05-02 15:30', dueAt: '2025-05-16', slaBreached: true, description: 'Hovli yo‘lakchalarini ta’mirlash va ko‘kalamzorlashtirish. Qabul qilishda sifat talabga javob bermadi.', progress: 80 },
  { id: 's-0690', code: 'SR-2025-0690', title: 'Zinalarga qo‘shimcha yoritish', category: 'Elektr', buildingId: 'b-05', unitId: null, organizationId: null, unitCode: 'Zinapoya', requesterName: 'Otabek Rahimov', priority: 'O‘rtacha', status: ServiceStatus.IN_PROGRESS, assigneeName: 'Jasur Toshmatov', createdAt: '2025-04-28 10:10', dueAt: '2025-05-12', slaBreached: true, description: 'Zinapoyalarda avariya yoritgichlarini o‘rnatish va datchiklarni sozlash.', progress: 45 },
  { id: 's-0685', code: 'SR-2025-0685', title: 'Suv oqish muammosi', category: 'Santexnika', buildingId: 'b-01', unitId: 'u-708', organizationId: 'org-grand-trade', unitCode: '708', requesterName: '«Grand Trade» MCHJ', priority: 'Yuqori', status: ServiceStatus.NEW, assigneeName: null, createdAt: '2025-05-17 17:45', dueAt: '2025-05-20', slaBreached: false, description: 'Sanuzelda quvurdan suv oqmoqda, shift qoplamasi namlangan.', progress: 0 },
  { id: 's-0684', code: 'SR-2025-0684', title: 'Yoritish ishlamayapti', category: 'Elektr', buildingId: 'b-01', unitId: 'u-708', organizationId: 'org-grand-trade', unitCode: '708', requesterName: '«Grand Trade» MCHJ', priority: 'O‘rtacha', status: ServiceStatus.TRIAGE, assigneeName: null, createdAt: '2025-05-16 09:30', dueAt: '2025-05-23', slaBreached: false, description: 'Ish xonasidagi ikkita LED panel yonmayapti.', progress: 10 },
  { id: 's-0680', code: 'SR-2025-0680', title: 'Eshik qulfi bo‘shashgan', category: 'Boshqa', buildingId: 'b-01', unitId: 'u-708', organizationId: 'org-grand-trade', unitCode: '708', requesterName: '«Grand Trade» MCHJ', priority: 'Past', status: ServiceStatus.IN_PROGRESS, assigneeName: 'Jasur Toshmatov', createdAt: '2025-05-13 14:00', dueAt: '2025-05-21', slaBreached: false, description: 'Kirish eshigining qulfi yaxshi yopilmayapti, mexanizmni sozlash kerak.', progress: 55 },
]

const WORK_CHECKLIST = [
  { label: 'Materiallar sifatini tekshirish', done: true },
  { label: 'O‘rnatish ishlari', done: true },
  { label: 'Ulanish va sinov', done: true },
  { label: 'Yoritish darajasi o‘lchovi', done: false },
  { label: 'Tozalash va ish joyini topshirish', done: false },
]

const WORK_MATERIALS = [
  { name: 'LED armatura 60W', qty: 24, unit: 'dona', price: 320000 },
  { name: 'Elektr kabel NYM 3x1.5', qty: 180, unit: 'metr', price: 18000 },
  { name: 'Avtomat 1P 10A', qty: 12, unit: 'dona', price: 95000 },
]

// ---------------------------------------------------------------------------
// Ombor

const WAREHOUSES = [
  { id: 'w-01', code: 'OMB-001', name: 'Markaziy ombor', buildingId: null, address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88' },
  { id: 'w-02', code: 'OMB-002', name: 'Green BC ombori', buildingId: 'b-01', address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88' },
  { id: 'w-03', code: 'OMB-003', name: 'Industrial Park ombori', buildingId: 'b-03', address: 'Toshkent viloyati, Yuqori Chirchiq tumani, Sanoat ko‘chasi 12' },
]

/**
 * Ombor pozitsiyalari `operations.ts` dagi ro‘yxat bilan bir xil.
 * Identifikator `wi-` bilan boshlanadi, chunki `w-` prefiksi ombor
 * yozuvlariga ajratilgan.
 */
const WAREHOUSE_ITEMS = [
  { id: 'wi-01', code: 'MB-0012', name: 'Stol (ishchi)', category: 'Mebel', unit: 'dona', qty: 28, minQty: 10, price: 1850000, warehouseId: 'w-01', addedAt: '2025-05-12' },
  { id: 'wi-02', code: 'MB-0018', name: 'Stul (ofis)', category: 'Mebel', unit: 'dona', qty: 56, minQty: 20, price: 720000, warehouseId: 'w-01', addedAt: '2025-05-12' },
  { id: 'wi-03', code: 'EL-0041', name: 'Konditsioner filtri', category: 'Elektr jihozlar', unit: 'dona', qty: 120, minQty: 30, price: 145000, warehouseId: 'w-01', addedAt: '2025-05-09' },
  { id: 'wi-04', code: 'EL-0055', name: 'Kabel (UTP Cat6)', category: 'Elektr jihozlar', unit: 'metr', qty: 350, minQty: 100, price: 12000, warehouseId: 'w-02', addedAt: '2025-05-06' },
  { id: 'wi-05', code: 'EL-0063', name: 'Lampa LED 18W', category: 'Elektr jihozlar', unit: 'dona', qty: 80, minQty: 60, price: 68000, warehouseId: 'w-02', addedAt: '2025-05-04' },
  { id: 'wi-06', code: 'SN-0009', name: 'Sanitariya jihozlari to‘plami', category: 'Sanitariya', unit: 'to‘plam', qty: 15, minQty: 20, price: 2400000, warehouseId: 'w-01', addedAt: '2025-04-28' },
  { id: 'wi-07', code: 'QR-0027', name: 'Sement M400', category: 'Qurilish', unit: 'qop', qty: 210, minQty: 50, price: 58000, warehouseId: 'w-03', addedAt: '2025-05-14' },
  { id: 'wi-08', code: 'IT-0004', name: 'Wi-Fi router', category: 'IT jihozlar', unit: 'dona', qty: 18, minQty: 8, price: 890000, warehouseId: 'w-01', addedAt: '2025-05-02' },
]

const MATERIAL_REQUESTS = [
  { id: 'mr-0098', code: 'MT-2025-0098', workOrderCode: 'SR-2025-0708', serviceRequestId: 's-0708', items: 3, amount: 12540000, status: MaterialStatus.APPROVED, createdAt: '2025-05-15', buildingId: 'b-01', buildingName: 'Green Business Center' },
  { id: 'mr-0097', code: 'MT-2025-0097', workOrderCode: 'SR-2025-0699', serviceRequestId: 's-0699', items: 5, amount: 8320000, status: MaterialStatus.ISSUED, createdAt: '2025-05-11', buildingId: 'b-04', buildingName: 'Harmony Residence' },
  { id: 'mr-0096', code: 'MT-2025-0096', workOrderCode: 'SR-2025-0690', serviceRequestId: 's-0690', items: 2, amount: 3150000, status: MaterialStatus.SUBMITTED, createdAt: '2025-05-09', buildingId: 'b-05', buildingName: 'Urban Office' },
  { id: 'mr-0095', code: 'MT-2025-0095', workOrderCode: 'SR-2025-0703', serviceRequestId: 's-0703', items: 4, amount: 6740000, status: MaterialStatus.ISSUED, createdAt: '2025-05-06', buildingId: 'b-02', buildingName: 'Mega Mall' },
  { id: 'mr-0094', code: 'MT-2025-0094', workOrderCode: 'SR-2025-0684', serviceRequestId: 's-0684', items: 1, amount: 1360000, status: MaterialStatus.REJECTED, createdAt: '2025-05-03', buildingId: 'b-01', buildingName: 'Green Business Center' },
]

// ---------------------------------------------------------------------------
// Hisoblagichlar

const METERS = [
  { id: 'm-01', code: 'MTR-EL-0012', type: 'Elektr', serial: 'EL-884512', buildingId: 'b-01', location: '5-qavat, elektr shchiti', measureUnit: 'kVt-soat', lastReading: 125430, previousReading: 121540, readAt: '2025-05-18', verifyAt: '2026-03-01', status: MeterStatus.ACTIVE },
  { id: 'm-02', code: 'MTR-SV-0007', type: 'Suv', serial: 'SV-442108', buildingId: 'b-01', location: 'Yerto‘la, suv tuguni', measureUnit: 'm³', lastReading: 8760, previousReading: 8642, readAt: '2025-05-18', verifyAt: '2026-01-15', status: MeterStatus.ACTIVE },
  { id: 'm-03', code: 'MTR-GZ-0003', type: 'Gaz', serial: 'GZ-119045', buildingId: 'b-02', location: 'Qozonxona', measureUnit: 'ming m³', lastReading: 63.2, previousReading: 61.4, readAt: '2025-05-17', verifyAt: '2025-11-20', status: MeterStatus.ACTIVE },
  { id: 'm-04', code: 'MTR-IS-0005', type: 'Issiqlik', serial: 'IS-770231', buildingId: 'b-04', location: 'Issiqlik punkti', measureUnit: 'Gkal', lastReading: 12340, previousReading: 12122, readAt: '2025-05-17', verifyAt: '2026-02-10', status: MeterStatus.ACTIVE },
  { id: 'm-05', code: 'MTR-EL-0021', type: 'Elektr', serial: 'EL-884590', buildingId: 'b-05', location: '3-qavat, elektr shchiti', measureUnit: 'kVt-soat', lastReading: 74210, previousReading: 72880, readAt: '2025-05-16', verifyAt: '2025-09-30', status: MeterStatus.MAINTENANCE },
]

// ---------------------------------------------------------------------------
// Bildirishnomalar

const NOTIFICATIONS = [
  { id: 'n-01', title: 'To‘lov muddati yaqinlashdi', body: 'INV-2025-0621 hisob-fakturasi bo‘yicha to‘lov muddatiga 3 kun qoldi.', category: 'To‘lovlar', at: '2025-05-19 10:30', read: false, icon: 'wallet' },
  { id: 'n-02', title: 'Servis arizasi bajarildi', body: 'SR-2025-0703 «Santexnika montaj ishlari» arizasi bajarildi va tasdiqlashga yuborildi.', category: 'Servis', at: '2025-05-19 09:15', read: false, icon: 'wrench' },
  { id: 'n-03', title: 'Yangi unit bo‘shadi', body: 'Green Business Center, 706-unit bo‘sh holatga o‘tdi va katalogda e’lon qilindi.', category: 'Arizalar', at: '2025-05-18 16:40', read: false, icon: 'building' },
  { id: 'n-04', title: 'Shartnoma tasdiqlashda', body: 'MKON-2025-0155 shartnomasi tasdiqlash uchun yuborildi va javob kutmoqda.', category: 'Hujjatlar', at: '2025-05-18 14:22', read: true, icon: 'contract' },
  { id: 'n-05', title: 'To‘lov kechikkanligi haqida ogohlantirish', body: 'Dream Retail bo‘yicha INV-2025-0584 hisob-fakturasi 61 kundan beri to‘lanmagan.', category: 'To‘lovlar', at: '2025-05-19 08:00', read: true, icon: 'warning' },
  { id: 'n-06', title: 'Tizimga kirish: yangi qurilma', body: 'Profilingizga yangi qurilmadan kirildi: Chrome, Windows 11.', category: 'Tizim', at: '2025-05-19 07:30', read: true, icon: 'shield' },
]

// ---------------------------------------------------------------------------
// Ijara ishlari

interface LeaseSeed {
  id: string
  code: string
  unitId: string
  organizationId: string
  status: LeaseStatus
  submittedAt: string
  startDate: string
  term: number
  offerPrice: number
  note: string
  rejectReason?: string
  offer?: { monthlyRent: number; deposit: number; servicePerSqm: number; periodicity: string }
}

const LEASE_CASES: LeaseSeed[] = [
  { id: 'a-0156', code: 'ARZ-2026-0156', unitId: 'u-704', organizationId: 'org-makon-solutions', status: LeaseStatus.YANGI, submittedAt: '2026-08-12 10:30', startDate: '2026-09-01', term: 36, offerPrice: 10900000, note: 'Uch yillik muddatga ijaraga olmoqchimiz, dastlabki ko‘rikni tashkil qilishingizni so‘raymiz.' },
  { id: 'a-0155', code: 'ARZ-2026-0155', unitId: 'u-301', organizationId: 'org-tech', status: LeaseStatus.OPERATSIYA_TASDIQLADI, submittedAt: '2026-08-11 14:05', startDate: '2026-09-01', term: 24, offerPrice: 18500000, note: 'Savdo nuqtasi ochish rejalashtirilgan. To‘lov shartlarini muhokama qilishni so‘raymiz.', offer: { monthlyRent: 18500000, deposit: 37000000, servicePerSqm: 21000, periodicity: 'Oylik' } },
  { id: 'a-0154', code: 'ARZ-2026-0154', unitId: 'u-b14', organizationId: 'org-megainvest', status: LeaseStatus.YANGI, submittedAt: '2026-08-10 09:20', startDate: '2026-10-01', term: 60, offerPrice: 31000000, note: 'Logistika markazi uchun ombor maydoni kerak.' },
  { id: 'a-0153', code: 'ARZ-2026-0153', unitId: 'u-706', organizationId: 'org-creative', status: LeaseStatus.OPERATSIYA_TASDIQLADI, submittedAt: '2026-08-06 16:40', startDate: '2026-09-01', term: 12, offerPrice: 11200000, note: 'Joriy ofisdan kengaytirish maqsadida qo‘shimcha maydon.', offer: { monthlyRent: 11200000, deposit: 22400000, servicePerSqm: 18000, periodicity: 'Choraklik' } },
  { id: 'a-0152', code: 'ARZ-2026-0152', unitId: 'u-402', organizationId: 'org-alpha', status: LeaseStatus.RAD_ETILDI, submittedAt: '2026-08-04 11:15', startDate: '2026-09-01', term: 24, offerPrice: 13400000, note: 'Vakillik ofisi uchun maydon so‘raladi.', rejectReason: 'Talab qilingan muddat bo‘sh maydon rejasiga to‘g‘ri kelmadi.' },
  { id: 'a-0151', code: 'ARZ-2026-0151', unitId: 'u-702', organizationId: 'org-urban-mchj', status: LeaseStatus.OPERATSIYA_TASDIQLADI, submittedAt: '2026-08-09 12:40', startDate: '2026-09-01', term: 24, offerPrice: 11800000, note: 'Qo‘shni maydonni qo‘shimcha ish o‘rinlari uchun ijaraga olish rejalashtirilgan.', offer: { monthlyRent: 11800000, deposit: 23600000, servicePerSqm: 18000, periodicity: 'Oylik' } },
  { id: 'a-0142', code: 'ARZ-2026-0142', unitId: 'u-505', organizationId: 'org-urban-mchj', status: LeaseStatus.RAD_ETILDI, submittedAt: '2026-07-15 09:30', startDate: '2026-08-01', term: 12, offerPrice: 74445000, note: 'Katta ochiq maydon so‘ralgan.', rejectReason: 'So‘ralgan muddat bino bo‘sh maydon rejasiga to‘g‘ri kelmadi.' },
]

const PERIODICITY_MONTHS: Record<string, number> = { Oylik: 1, Choraklik: 3, Yillik: 12 }
const MONTH_NAMES = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

function addMonths(base: Date, months: number): Date {
  const result = new Date(base.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, last))
  return result
}

function addDays(base: Date, days: number): Date {
  const result = new Date(base.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dmy(value: Date): string {
  return `${pad(value.getUTCDate())}.${pad(value.getUTCMonth() + 1)}.${value.getUTCFullYear()}`
}

/** To‘lov grafigi, `app/stores/lease.ts` dagi hisob-kitob bilan bir xil. */
function buildSchedule(
  offer: { monthlyRent: number; deposit: number; servicePerSqm: number; periodicity: string },
  startDate: Date,
  term: number,
  area: number,
) {
  const rows: Array<{
    kind: ScheduleKind
    label: string
    dueAt: Date
    months: number
    rent: number
    service: number
    total: number
    position: number
  }> = []

  const service = Math.round(offer.servicePerSqm * area)
  const step = PERIODICITY_MONTHS[offer.periodicity] ?? 1
  let position = 0

  if (offer.deposit > 0) {
    rows.push({
      kind: ScheduleKind.DEPOSIT,
      label: 'Kafolat depoziti',
      dueAt: startDate,
      months: 0,
      rent: 0,
      service: 0,
      total: Math.round(offer.deposit),
      position: position++,
    })
  }

  let passed = 0
  while (passed < term) {
    const months = Math.min(step, term - passed)
    const from = addMonths(startDate, passed)
    const to = addDays(addMonths(startDate, passed + months), -1)
    const rent = Math.round(offer.monthlyRent * months)
    const serviceSum = service * months

    rows.push({
      kind: ScheduleKind.RENT,
      label:
        months === 1
          ? `${MONTH_NAMES[from.getUTCMonth()]} ${from.getUTCFullYear()}`
          : `${dmy(from)} , ${dmy(to)}`,
      dueAt: from,
      months,
      rent,
      service: serviceSum,
      total: rent + serviceSum,
      position: position++,
    })

    passed += months
  }

  return rows
}

// ---------------------------------------------------------------------------

async function reset(): Promise<void> {
  // Bog‘liqlik tartibi bo‘yicha tozalash
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.document.deleteMany()
  await prisma.meterReading.deleteMany()
  await prisma.meter.deleteMany()
  await prisma.inventoryLine.deleteMany()
  await prisma.inventorySession.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.materialRequestLine.deleteMany()
  await prisma.materialRequest.deleteMany()
  await prisma.warehouseItem.deleteMany()
  await prisma.warehouse.deleteMany()
  await prisma.workOrder.deleteMany()
  await prisma.serviceRequest.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.debt.deleteMany()
  await prisma.invoiceLine.deleteMany()
  await prisma.paymentSchedule.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.billingPeriod.deleteMany()
  await prisma.contractTimelineEntry.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.didoxTicket.deleteMany()
  await prisma.commercialOffer.deleteMany()
  await prisma.leaseCase.deleteMany()
  await prisma.unitPolygon.deleteMany()
  await prisma.unit.deleteMany()
  await prisma.floor.deleteMany()
  await prisma.building.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.otpCode.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()
}

async function main(): Promise<void> {
  const password = process.env.SEED_DEFAULT_PASSWORD
  if (!password || password.length < 8) {
    throw new Error(
      'SEED_DEFAULT_PASSWORD muhit o‘zgaruvchisi berilmagan yoki juda qisqa. ' +
        '.env faylida kamida 8 belgili qiymat ko‘rsating.',
    )
  }

  await reset()

  const passwordHash = await hash(password, { memoryCost: 19_456, timeCost: 3, parallelism: 1 })

  // --- Tashkilotlar --------------------------------------------------------
  for (const organization of ORGANIZATIONS) {
    await prisma.organization.create({ data: organization })
  }

  // --- Foydalanuvchilar ----------------------------------------------------
  for (const user of USERS) {
    await prisma.user.create({ data: { ...user, passwordHash } })
  }

  // --- Obyektlar -----------------------------------------------------------
  for (const building of BUILDINGS) {
    await prisma.building.create({
      data: {
        ...building,
        gla: D(building.gla),
        vacantArea: D(building.vacantArea),
        monthlyRevenue: D(building.monthlyRevenue),
        debt: D(building.debt),
      },
    })
  }

  // --- Qavatlar ------------------------------------------------------------
  for (const building of BUILDINGS) {
    const levels = [...new Set(UNITS.filter((u) => u.buildingId === building.id).map((u) => u.floor))]
    for (const level of levels.sort((a, b) => a - b)) {
      const area = UNITS.filter((u) => u.buildingId === building.id && u.floor === level).reduce(
        (sum, u) => sum + u.area,
        0,
      )
      await prisma.floor.create({
        data: {
          id: `f-${building.id}-${level}`,
          buildingId: building.id,
          level,
          label: `${level}-qavat`,
          plan: `${building.slug}-floor-${level}`,
          totalArea: D(Math.round(area * 100) / 100),
        },
      })
    }
  }

  // --- Unitlar -------------------------------------------------------------
  for (const unit of UNITS) {
    await prisma.unit.create({
      data: {
        id: unit.id,
        code: unit.code,
        buildingId: unit.buildingId,
        floorId: `f-${unit.buildingId}-${unit.floor}`,
        floor: unit.floor,
        rooms: unit.rooms,
        area: D(unit.area),
        usage: unit.usage,
        offer: unit.offer,
        status: unit.status,
        listing:
          unit.status === UnitStatus.VACANT ? ListingStatus.PUBLISHED : ListingStatus.ARCHIVED,
        price: D(unit.price),
        priceUnit: unit.priceUnit,
        tenantName: unit.tenant ?? null,
        contractCode: unit.contractCode ?? null,
        equipment: unit.equipment,
        polygon: { create: { points: unit.polygon, authorId: 'u-007' } },
      },
    })
  }

  // --- Shartnomalar --------------------------------------------------------
  for (const contract of CONTRACTS) {
    await prisma.contract.create({
      data: {
        id: contract.id,
        code: contract.code,
        type: contract.type,
        status: contract.status,
        organizationId: contract.organizationId,
        buildingId: contract.buildingId,
        unitId: contract.unitId,
        tenantName:
          ORGANIZATIONS.find((o) => o.id === contract.organizationId)?.name ?? contract.unitCode,
        buildingName: BUILDINGS.find((b) => b.id === contract.buildingId)?.name ?? '',
        unitCode: contract.unitCode,
        startsAt: date(contract.startsAt),
        endsAt: contract.endsAt ? date(contract.endsAt) : null,
        amount: D(contract.amount),
        paymentTerm: contract.paymentTerm,
        composedAt: date(contract.timeline[0]?.date ?? contract.startsAt),
        activatedAt: contract.status === ContractStatus.ACTIVE ? date(contract.startsAt) : null,
        timeline: {
          createMany: {
            data: contract.timeline.map((entry, index) => ({
              label: entry.label,
              occurredAt: entry.date ? date(entry.date) : null,
              actor: entry.actor,
              done: entry.done,
              position: index,
            })),
          },
        },
        documents: {
          createMany: {
            data: contract.documents.map((doc) => ({
              kind:
                doc.type === 'xlsx'
                  ? DocumentKind.SCHEDULE
                  : contract.status === ContractStatus.DRAFT
                    ? DocumentKind.CONTRACT_DRAFT
                    : DocumentKind.SIGNED_CONTRACT,
              fileName: doc.name,
              storageKey: `contracts/${contract.code}/${doc.name}`,
              mimeType:
                doc.type === 'pdf'
                  ? 'application/pdf'
                  : doc.type === 'xlsx'
                    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              extension: doc.type,
              size: doc.size,
              organizationId: contract.organizationId,
              uploadedById: 'u-002',
              uploadedByName: 'Sardor Yo‘ldoshev',
            })),
          },
        },
      },
    })
  }

  // --- Hisob-kitob davrlari ------------------------------------------------
  const PERIODS = [
    { code: '2025-02', label: 'Fevral 2025', year: 2025, month: 2, startsAt: '2025-02-01', endsAt: '2025-02-28' },
    { code: '2025-03', label: 'Mart 2025', year: 2025, month: 3, startsAt: '2025-03-01', endsAt: '2025-03-31' },
    { code: '2025-04', label: 'Aprel 2025', year: 2025, month: 4, startsAt: '2025-04-01', endsAt: '2025-04-30' },
    { code: '2025-05', label: 'May 2025', year: 2025, month: 5, startsAt: '2025-05-01', endsAt: '2025-05-31' },
  ]

  for (const period of PERIODS) {
    const invoices = INVOICES.filter((invoice) => invoice.periodCode === period.code)
    const charged = invoices.reduce((sum, invoice) => sum + invoice.total, 0)
    const paid = invoices.reduce((sum, invoice) => sum + invoice.paid, 0)
    const overdue = invoices
      .filter((invoice) => invoice.status === InvoiceStatus.OVERDUE)
      .reduce((sum, invoice) => sum + invoice.total - invoice.paid, 0)

    await prisma.billingPeriod.create({
      data: {
        id: `bp-${period.code}`,
        code: period.code,
        label: period.label,
        year: period.year,
        month: period.month,
        startsAt: date(period.startsAt),
        endsAt: date(period.endsAt),
        status: period.code === '2025-05' ? 'OPEN' : 'CLOSED',
        charged: D(charged),
        discounts: D(period.code === '2025-05' ? 5850000 : 0),
        vat: D(period.code === '2025-05' ? 14925000 : 0),
        total: D(charged),
        paidTotal: D(paid),
        debtTotal: D(Math.max(0, charged - paid)),
        overdueTotal: D(overdue),
        closedAt: period.code === '2025-05' ? null : date(period.endsAt),
      },
    })
  }

  // --- Hisob-fakturalar ----------------------------------------------------
  for (const invoice of INVOICES) {
    const scale = invoice.total / TARIFF_LINES.reduce((sum, line) => sum + line.sum, 0)
    await prisma.invoice.create({
      data: {
        id: invoice.id,
        code: invoice.code,
        organizationId: invoice.organizationId,
        contractId: invoice.contractId,
        buildingId: invoice.buildingId,
        unitId: invoice.unitId,
        periodId: `bp-${invoice.periodCode}`,
        periodLabel: invoice.periodLabel,
        issuedAt: date(invoice.issuedAt),
        dueAt: date(invoice.dueAt),
        total: D(invoice.total),
        paid: D(invoice.paid),
        status: invoice.status,
        agingBucket: invoice.agingBucket,
        tenantName: invoice.tenantName,
        buildingName: invoice.buildingName,
        unitCode: invoice.unitCode,
        lines: {
          createMany: {
            data: TARIFF_LINES.map((line, index) => ({
              service: line.service,
              unit: line.unit,
              tariff: D(line.tariff),
              qty: D(Math.round(line.qty * scale * 1000) / 1000),
              sum: D(Math.round(line.sum * scale)),
              position: index,
            })),
          },
        },
      },
    })

    if (invoice.paid > 0) {
      await prisma.payment.create({
        data: {
          code: `PAY-2025-${invoice.code.slice(-4)}`,
          invoiceId: invoice.id,
          organizationId: invoice.organizationId,
          amount: D(invoice.paid),
          method: 'BANK_TRANSFER',
          status: 'CONFIRMED',
          paidAt: date(invoice.dueAt),
          reference: `${invoice.code} bo‘yicha to‘lov`,
          confirmedById: 'u-003',
          confirmedAt: date(invoice.dueAt),
        },
      })
    }

    if (invoice.agingBucket && invoice.total > invoice.paid) {
      const days =
        invoice.agingBucket === '0-30'
          ? 18
          : invoice.agingBucket === '31-60'
            ? 45
            : invoice.agingBucket === '61-90'
              ? 72
              : 104
      await prisma.debt.create({
        data: {
          organizationId: invoice.organizationId,
          buildingId: invoice.buildingId,
          invoiceId: invoice.id,
          amount: D(invoice.total - invoice.paid),
          daysOverdue: days,
          agingBucket: invoice.agingBucket,
          status: 'OPEN',
          note: `${invoice.code} bo‘yicha kechikish`,
        },
      })
    }
  }

  // --- Servis arizalari va ish topshiriqlari -------------------------------
  let workOrderSequence = 300
  for (const request of SERVICE_REQUESTS) {
    await prisma.serviceRequest.create({
      data: {
        id: request.id,
        code: request.code,
        title: request.title,
        category: request.category,
        buildingId: request.buildingId,
        unitId: request.unitId,
        organizationId: request.organizationId,
        unitCode: request.unitCode,
        requesterName: request.requesterName,
        priority: request.priority,
        status: request.status,
        assigneeName: request.assigneeName,
        createdAt: stamp(request.createdAt),
        dueAt: date(request.dueAt),
        slaBreached: request.slaBreached,
        description: request.description,
        progress: request.progress,
        closedAt: request.status === ServiceStatus.CLOSED ? date(request.dueAt) : null,
      },
    })

    if (!request.assigneeName) continue

    workOrderSequence += 1
    await prisma.workOrder.create({
      data: {
        id: `wo-${request.id.slice(2)}`,
        code: `WO-2025-0${workOrderSequence}`,
        serviceRequestId: request.id,
        buildingId: request.buildingId,
        title: request.title,
        status:
          request.status === ServiceStatus.COMPLETED
            ? WorkOrderStatus.COMPLETED
            : request.status === ServiceStatus.RETURNED
              ? WorkOrderStatus.RETURNED
              : WorkOrderStatus.IN_PROGRESS,
        assigneeId: 'u-004',
        assigneeName: request.assigneeName,
        startedAt: stamp(request.createdAt),
        completedAt: request.status === ServiceStatus.COMPLETED ? date(request.dueAt) : null,
        dueAt: date(request.dueAt),
        progress: request.progress,
        checklist: WORK_CHECKLIST,
        resultNote: request.status === ServiceStatus.COMPLETED ? 'Ishlar to‘liq bajarildi' : '',
      },
    })
  }

  // --- Ombor ---------------------------------------------------------------
  for (const warehouse of WAREHOUSES) {
    await prisma.warehouse.create({ data: warehouse })
  }

  for (const item of WAREHOUSE_ITEMS) {
    await prisma.warehouseItem.create({
      data: {
        ...item,
        qty: D(item.qty),
        minQty: D(item.minQty),
        price: D(item.price),
        addedAt: date(item.addedAt),
      },
    })
    await prisma.stockMovement.create({
      data: {
        code: `SM-2025-${item.code}`,
        warehouseItemId: item.id,
        warehouseId: item.warehouseId,
        kind: StockMovementKind.INBOUND,
        qty: D(item.qty),
        price: D(item.price),
        sum: D(item.qty * item.price),
        reason: 'Boshlang‘ich qoldiq kiritildi',
        performedById: 'u-006',
        occurredAt: date(item.addedAt),
      },
    })
  }

  for (const request of MATERIAL_REQUESTS) {
    const lines = WORK_MATERIALS.slice(0, Math.min(request.items, WORK_MATERIALS.length))
    await prisma.materialRequest.create({
      data: {
        id: request.id,
        code: request.code,
        workOrderId: `wo-${request.serviceRequestId.slice(2)}`,
        workOrderCode: request.workOrderCode,
        buildingId: request.buildingId,
        buildingName: request.buildingName,
        requesterId: 'u-004',
        requesterName: 'Jasur Toshmatov',
        warehouseId: 'w-01',
        status: request.status,
        itemCount: request.items,
        amount: D(request.amount),
        createdAt: date(request.createdAt),
        approvedById: request.status === MaterialStatus.SUBMITTED ? null : 'u-002',
        approvedAt: request.status === MaterialStatus.SUBMITTED ? null : date(request.createdAt),
        issuedAt: request.status === MaterialStatus.ISSUED ? date(request.createdAt) : null,
        lines: {
          createMany: {
            data: lines.map((line) => ({
              name: line.name,
              unit: line.unit,
              qty: D(line.qty),
              price: D(line.price),
              sum: D(line.qty * line.price),
            })),
          },
        },
      },
    })
  }

  // --- Hisoblagichlar ------------------------------------------------------
  for (const meter of METERS) {
    await prisma.meter.create({
      data: {
        ...meter,
        lastReading: D(meter.lastReading),
        previousReading: D(meter.previousReading),
        readAt: date(meter.readAt),
        verifyAt: date(meter.verifyAt),
        readings: {
          create: {
            value: D(meter.lastReading),
            previousValue: D(meter.previousReading),
            consumption: D(meter.lastReading - meter.previousReading),
            readAt: date(meter.readAt),
            recordedById: 'u-004',
          },
        },
      },
    })
  }

  // --- Ijara ishlari -------------------------------------------------------
  for (const seed of LEASE_CASES) {
    const unit = UNITS.find((u) => u.id === seed.unitId)
    if (!unit) continue
    const organization = ORGANIZATIONS.find((o) => o.id === seed.organizationId)

    await prisma.leaseCase.create({
      data: {
        id: seed.id,
        code: seed.code,
        status: seed.status,
        applicationStatus:
          seed.status === LeaseStatus.RAD_ETILDI
            ? 'REJECTED'
            : seed.status === LeaseStatus.OPERATSIYA_TASDIQLADI
              ? 'FINANCE_REVIEW'
              : 'SUBMITTED',
        organizationId: seed.organizationId,
        unitId: seed.unitId,
        buildingId: unit.buildingId,
        requestType: 'Ijaraga olish',
        offerPrice: D(seed.offerPrice),
        startDate: date(seed.startDate),
        term: seed.term,
        note: seed.note,
        contactPerson: organization?.director ?? null,
        contactPhone: organization?.phone ?? null,
        contactedAt:
          seed.status === LeaseStatus.OPERATSIYA_TASDIQLADI ? stamp(seed.submittedAt) : null,
        contactedById: seed.status === LeaseStatus.OPERATSIYA_TASDIQLADI ? 'u-002' : null,
        rejectReason: seed.rejectReason ?? '',
        submittedAt: stamp(seed.submittedAt),
      },
    })

    await prisma.auditLog.create({
      data: {
        actorName: organization?.director ?? 'Ijarachi',
        actorRole: 'Ijarachi / mulkdor',
        action: 'Ariza yuborildi',
        entityType: 'leaseCase',
        entityId: seed.id,
        detail: `${unit.code} uniti bo‘yicha ${seed.term} oylik ijara so‘rovi`,
        createdAt: stamp(seed.submittedAt),
      },
    })

    if (seed.offer) {
      await prisma.commercialOffer.create({
        data: {
          leaseCaseId: seed.id,
          monthlyRent: D(seed.offer.monthlyRent),
          deposit: D(seed.offer.deposit),
          servicePerSqm: D(seed.offer.servicePerSqm),
          periodicity: seed.offer.periodicity,
          approvedByOpsId: 'u-002',
          approvedByOpsAt: stamp(seed.submittedAt),
        },
      })

      const rows = buildSchedule(seed.offer, date(seed.startDate), seed.term, unit.area)
      await prisma.paymentSchedule.createMany({
        data: rows.map((row) => ({
          leaseCaseId: seed.id,
          kind: row.kind,
          label: row.label,
          dueAt: row.dueAt,
          months: row.months,
          rent: D(row.rent),
          service: D(row.service),
          total: D(row.total),
          status: SchedulePeriodStatus.PLANNED,
          position: row.position,
        })),
      })

      await prisma.auditLog.create({
        data: {
          actorId: 'u-002',
          actorName: 'Sardor Yo‘ldoshev',
          actorRole: 'Bino rahbari',
          action: 'Operatsiya tasdiqladi',
          entityType: 'leaseCase',
          entityId: seed.id,
          detail: 'Kelishilgan shartlar kiritildi va to‘lov grafigi hisoblandi',
          createdAt: addDays(stamp(seed.submittedAt), 1),
        },
      })
    }

    if (seed.rejectReason) {
      await prisma.auditLog.create({
        data: {
          actorId: 'u-002',
          actorName: 'Sardor Yo‘ldoshev',
          actorRole: 'Bino rahbari',
          action: 'Ariza rad etildi',
          entityType: 'leaseCase',
          entityId: seed.id,
          detail: seed.rejectReason,
          createdAt: addDays(stamp(seed.submittedAt), 2),
        },
      })
    }
  }

  // --- Bildirishnomalar ----------------------------------------------------
  for (const notification of NOTIFICATIONS) {
    for (const user of USERS.filter((u) => u.organizationId === 'org-makon')) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: notification.title,
          body: notification.body,
          category: notification.category,
          icon: notification.icon,
          read: notification.read,
          readAt: notification.read ? stamp(notification.at) : null,
          createdAt: stamp(notification.at),
        },
      })
    }
  }

  const counts = {
    organizations: await prisma.organization.count(),
    users: await prisma.user.count(),
    buildings: await prisma.building.count(),
    floors: await prisma.floor.count(),
    units: await prisma.unit.count(),
    contracts: await prisma.contract.count(),
    invoices: await prisma.invoice.count(),
    payments: await prisma.payment.count(),
    debts: await prisma.debt.count(),
    serviceRequests: await prisma.serviceRequest.count(),
    workOrders: await prisma.workOrder.count(),
    materialRequests: await prisma.materialRequest.count(),
    warehouseItems: await prisma.warehouseItem.count(),
    meters: await prisma.meter.count(),
    leaseCases: await prisma.leaseCase.count(),
    notifications: await prisma.notification.count(),
  }

  process.stdout.write(`Boshlang‘ich ma’lumotlar yozildi: ${JSON.stringify(counts, null, 2)}\n`)
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Xatolik: ${String(error)}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
