export interface Building {
  id: string
  code: string
  name: string
  slug: string
  type: 'Biznes markaz' | 'Savdo markaz' | 'Ombor / logistika' | 'Turar joy' | 'Ofis binosi'
  city: string
  district: string
  street: string
  buildYear: number
  buildingClass: string
  floors: number
  undergroundFloors: number
  units: number
  occupiedUnits: number
  vacantUnits: number
  /** Ijaraga beriladigan umumiy maydon, m² */
  gla: number
  vacantArea: number
  occupancy: number
  monthlyRevenue: number
  debt: number
  sla: number
  /** Joriy davrdagi servis arizalari soni */
  serviceRequests: number
  /** Xaritadagi haqiqiy joylashuv */
  lat: number
  lon: number
  /** public/img/ dagi fotosurat asosi — {photo}-sm|md|lg.webp */
  photo: string
  /** Qo‘shimcha rakurslar (galereya uchun) */
  gallery: string[]
  manager: string
  managerPhone: string
  status: 'ACTIVE' | 'ARCHIVED'
  amenities: string[]
  equipment: string[]
}

export const BUILDINGS: Building[] = [
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
    units: 192,
    occupiedUnits: 177,
    vacantUnits: 15,
    gla: 120000,
    vacantArea: 9600,
    occupancy: 92,
    monthlyRevenue: 3420000000,
    debt: 18200000,
    sla: 97,
    serviceRequests: 42,
    lat: 41.3167,
    lon: 69.2833,
    photo: 'green-business-center',
    gallery: ['green-business-center', 'green-business-center-2', 'green-business-center-3', 'interior-office'],
    manager: 'Sardor Yo‘ldoshev',
    managerPhone: '+998 90 234 56 78',
    status: 'ACTIVE',
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
    units: 148,
    occupiedUnits: 130,
    vacantUnits: 18,
    gla: 98500,
    vacantArea: 11820,
    occupancy: 88,
    monthlyRevenue: 2810000000,
    debt: 22500000,
    sla: 95,
    serviceRequests: 36,
    lat: 41.2756,
    lon: 69.2036,
    photo: 'mega-mall',
    gallery: ['mega-mall', 'mega-mall-2', 'mega-mall-3', 'mega-mall-4'],
    manager: 'Dilshod Karimov',
    managerPhone: '+998 90 311 22 33',
    status: 'ACTIVE',
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
    units: 64,
    occupiedUnits: 54,
    vacantUnits: 10,
    gla: 75000,
    vacantArea: 12000,
    occupancy: 84,
    monthlyRevenue: 1920000000,
    debt: 27400000,
    sla: 96,
    serviceRequests: 24,
    lat: 41.26,
    lon: 69.59,
    photo: 'industrial-park-2',
    gallery: ['industrial-park-2', 'industrial-park-2-2', 'industrial-park-2-3'],
    manager: 'Bobur Ismoilov',
    managerPhone: '+998 90 422 55 66',
    status: 'ACTIVE',
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
    units: 128,
    occupiedUnits: 106,
    vacantUnits: 22,
    gla: 80000,
    vacantArea: 13600,
    occupancy: 83,
    monthlyRevenue: 2280000000,
    debt: 31600000,
    sla: 94,
    serviceRequests: 30,
    lat: 41.2831,
    lon: 69.25,
    photo: 'harmony-residence',
    gallery: ['harmony-residence'],
    manager: 'Nigora Aripova',
    managerPhone: '+998 90 533 77 88',
    status: 'ACTIVE',
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
    units: 96,
    occupiedUnits: 77,
    vacantUnits: 19,
    gla: 51900,
    vacantArea: 8256,
    occupancy: 80,
    monthlyRevenue: 2110000000,
    debt: 25700000,
    sla: 95,
    serviceRequests: 24,
    lat: 41.345,
    lon: 69.287,
    photo: 'urban-office',
    gallery: ['urban-office', 'urban-office-2', 'urban-office-3', 'urban-office-4'],
    manager: 'Otabek Rahimov',
    managerPhone: '+998 90 644 99 00',
    status: 'ACTIVE',
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

export const PORTFOLIO_TOTALS = {
  gla: 425400,
  occupancy: 87,
  revenue: 12540000000,
  vacantArea: 55276,
  sla: 96,
  buildings: BUILDINGS.length,
  units: BUILDINGS.reduce((s, b) => s + b.units, 0),
  vacantUnits: BUILDINGS.reduce((s, b) => s + b.vacantUnits, 0),
  debt: BUILDINGS.reduce((s, b) => s + b.debt, 0),
}

export function buildingById(id: string) {
  return BUILDINGS.find((b) => b.id === id)
}

export function buildingBySlug(slug: string) {
  return BUILDINGS.find((b) => b.slug === slug)
}
