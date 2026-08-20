import { computed, reactive } from 'vue'
import { INVOICES, settledInvoices } from './business'
import { SERVICE_REQUESTS } from './operations'
import { UNITS } from './units'
import { todayIso } from '~/utils/format'

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
  /** UNITS reyestridagi shu obyekt unitlari soni */
  units: number
  /** Band unitlar: shartnoma bo‘yicha ijaradagi yoki sotilgan */
  occupiedUnits: number
  /** Bo‘sh unitlar: ijaraga taklif qilinayotganlari */
  vacantUnits: number
  /** Ijaraga beriladigan umumiy maydon, m²: unit reja maydonlari yig‘indisi */
  gla: number
  /** Bo‘sh unitlar maydoni, m² */
  vacantArea: number
  /** Shartnoma bo‘yicha egallangan maydon, m² */
  occupiedArea: number
  /** Bandlik, %: egallangan maydonning umumiy maydondagi ulushi */
  occupancy: number
  monthlyRevenue: number
  /** Qarzdorlik: to‘lanmagan hisob-faktura qoldiqlari, INVOICES reyestridan */
  debt: number
  sla: number
  /** SERVICE_REQUESTS reyestridagi shu obyektga tegishli arizalar soni */
  serviceRequests: number
  /** Xaritadagi haqiqiy joylashuv */
  lat: number
  lon: number
  /** public/img/ dagi fotosurat asosi, {photo}-sm|md|lg.webp */
  photo: string
  /** Qo‘shimcha rakurslar (galereya uchun) */
  gallery: string[]
  manager: string
  managerPhone: string
  status: 'ACTIVE' | 'ARCHIVED'
  amenities: string[]
  equipment: string[]
}

/**
 * Reyestrdan hisoblanadigan maydonlar. Bino yozuvida qo‘lda saqlanmaydi:
 * yagona manba unit reyestri (units.ts), hisob-faktura reyestri (business.ts)
 * va servis arizalari reyestri (operations.ts) bo‘ladi. Shuning uchun bino
 * pasporti, qavat rejasi, 3D ko‘rinish va hujjatlardagi raqamlar bir xil.
 */
export type DerivedBuildingKey =
  | 'units'
  | 'occupiedUnits'
  | 'vacantUnits'
  | 'gla'
  | 'vacantArea'
  | 'occupiedArea'
  | 'occupancy'
  | 'debt'
  | 'serviceRequests'

/** Bino pasportining qo‘lda yuritiladigan qismi */
export type BuildingSeed = Omit<Building, DerivedBuildingKey>

export interface BuildingUnitStats {
  units: number
  occupiedUnits: number
  vacantUnits: number
  gla: number
  vacantArea: number
  /** Shartnoma bo‘yicha egallangan maydon, m² */
  occupiedArea: number
  occupancy: number
}

/** Kasr maydonlar yig‘indisidagi suzuvchi nuqta shovqinini olib tashlaydi */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Bino bo‘yicha unit reyestri kesimi, bitta o‘tishda hisoblanadi. Bandlik
 * maydon bo‘yicha o‘lchanadi: qavat rejasi va 3D ko‘rinish ham aynan shu
 * formuladan foydalanadi, shuning uchun uch ekranda bir xil foiz chiqadi.
 */
export function unitStatsOf(buildingId: string): BuildingUnitStats {
  let units = 0
  let occupiedUnits = 0
  let vacantUnits = 0
  let gla = 0
  let vacantArea = 0

  /*
   * Bandlik yagona ta'rif bilan hisoblanadi: shartnoma bo'yicha egallangan
   * maydonning ijaraga beriladigan umumiy maydondagi ulushi. Ilgari KPI
   * "bo'sh emas" ni band deb sanardi, qavatlar jadvali esa faqat "ijarada"
   * va "sotilgan" ni, natijada bitta ekranda 73% va 57% turardi: rezerv va
   * ta'mirdagi unitlar birinchisida band, ikkinchisida bo'sh edi.
   */
  let occupiedArea = 0
  for (const unit of UNITS) {
    if (unit.buildingId !== buildingId) continue
    units += 1
    gla += unit.area
    if (unit.status === 'RENTED' || unit.status === 'SOLD') {
      occupiedUnits += 1
      occupiedArea += unit.area
    }
    if (unit.status === 'VACANT') {
      vacantUnits += 1
      vacantArea += unit.area
    }
  }

  gla = round2(gla)
  vacantArea = round2(vacantArea)
  occupiedArea = round2(occupiedArea)

  return {
    units,
    occupiedUnits,
    vacantUnits,
    gla,
    vacantArea,
    occupiedArea,
    occupancy: gla ? Math.round((occupiedArea / gla) * 100) : 0,
  }
}

/**
 * Qarzdorlikning yagona ta’rifi: to‘lanmagan hisob-faktura qoldiqlari.
 * Billing jamlari, qarzdorlar ro‘yxati va bino kartochkasi shu manbadan
 * o‘qiydi, shuning uchun uchala ekranda bir xil summa turadi.
 */
export function invoiceDebtOf(buildingName: string): number {
  return settledInvoices(INVOICES)
    .filter((invoice) => invoice.buildingName === buildingName)
    .reduce((sum, invoice) => sum + Math.max(0, invoice.total - invoice.paid), 0)
}

/** Servis arizalari reyestridagi shu obyektga tegishli yozuvlar soni */
export function serviceRequestCountOf(buildingName: string): number {
  return SERVICE_REQUESTS.filter((request) => request.buildingName === buildingName).length
}

/**
 * Yozuvga reyestrdan o‘qiydigan maydonlarni ulaydi. Qiymatlar `computed`
 * orqali keshlanadi: reyestr o‘zgarmaguncha qayta hisoblanmaydi, o‘zgarganda
 * esa barcha sahifada darhol yangilanadi. Hisoblash faqat maydon o‘qilganda
 * ishga tushadi, modul yuklanayotganda emas.
 *
 * Setter ataylab bo‘sh qoldirilgan: shartnoma faollashtirilganda bino
 * statistikasini qo‘lda oshirmoqchi bo‘lgan eski kod xato bermaydi, qiymat
 * esa baribir reyestrdan olinadi.
 */
function withRegistryStats(seed: BuildingSeed): Building {
  const record = reactive({ ...seed }) as Building
  const stats = computed(() => unitStatsOf(record.id))
  const debt = computed(() => invoiceDebtOf(record.name))
  const requests = computed(() => serviceRequestCountOf(record.name))

  const derive = (key: DerivedBuildingKey, read: () => number) => {
    Object.defineProperty(record, key, {
      enumerable: true,
      configurable: true,
      get: read,
      set: () => {},
    })
  }

  derive('units', () => stats.value.units)
  derive('occupiedUnits', () => stats.value.occupiedUnits)
  derive('vacantUnits', () => stats.value.vacantUnits)
  derive('gla', () => stats.value.gla)
  derive('vacantArea', () => stats.value.vacantArea)
  derive('occupiedArea', () => stats.value.occupiedArea)
  derive('occupancy', () => stats.value.occupancy)
  derive('debt', () => debt.value)
  derive('serviceRequests', () => requests.value)

  return record
}

const BUILDING_SEEDS: BuildingSeed[] = [
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
    monthlyRevenue: 3420000000,
    sla: 97,
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
    monthlyRevenue: 2810000000,
    sla: 95,
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
    monthlyRevenue: 1920000000,
    sla: 96,
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
    monthlyRevenue: 2280000000,
    sla: 94,
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
    monthlyRevenue: 2110000000,
    sla: 95,
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
  {
    id: 'b-06',
    code: 'BIN-0006',
    name: 'Chorsu Savdo Galereyasi',
    slug: 'chorsu-savdo-galereyasi',
    type: 'Savdo markaz',
    city: 'Toshkent',
    district: 'Shayxontohur tumani',
    street: 'Navoiy ko‘chasi 62',
    buildYear: 2018,
    buildingClass: 'B+ klass',
    floors: 4,
    undergroundFloors: 1,
    monthlyRevenue: 1350000000,
    sla: 94,
    lat: 41.3268,
    lon: 69.2354,
    photo: 'mega-mall-2',
    gallery: ['mega-mall-2', 'mega-mall-4', 'mega-mall'],
    manager: 'Jasur Toshmatov',
    managerPhone: '+998 90 712 34 56',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yer usti parkovka',
      'Markaziy sovitish',
      'Eskalatorlar',
      'Yong‘inga qarshi tizim',
    ],
    equipment: ['Lift (4)', 'Eskalator (6)', 'Generator', 'CCTV', 'Havo tozalash tizimi'],
  },
  {
    id: 'b-07',
    code: 'BIN-0007',
    name: 'Yunusobod Tower',
    slug: 'yunusobod-tower',
    type: 'Biznes markaz',
    city: 'Toshkent',
    district: 'Yunusobod tumani',
    street: 'Amir Temur shoh ko‘chasi 107',
    buildYear: 2024,
    buildingClass: 'A klass',
    floors: 18,
    undergroundFloors: 2,
    monthlyRevenue: 2784000000,
    sla: 97,
    lat: 41.3379,
    lon: 69.2846,
    photo: 'green-business-center-2',
    gallery: ['green-business-center-2', 'green-business-center', 'interior-office'],
    manager: 'Shahnoza Umarova',
    managerPhone: '+998 90 178 45 12',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yuqori tezlikdagi internet',
      'Markaziy isitish va sovitish',
      'Panoramali liftlar',
      'Yong‘inga qarshi tizim',
    ],
    equipment: ['Lift (6)', 'Generator', 'Yong‘in signalizatsiyasi', 'Suv nasosi', 'CCTV'],
  },
  {
    id: 'b-08',
    code: 'BIN-0008',
    name: 'Salar Logistika Markazi',
    slug: 'salar-logistika-markazi',
    type: 'Ombor / logistika',
    city: 'Toshkent',
    district: 'Yashnobod tumani',
    street: 'Farg‘ona yo‘li ko‘chasi 46',
    buildYear: 2021,
    buildingClass: 'B klass',
    floors: 2,
    undergroundFloors: 0,
    monthlyRevenue: 1178000000,
    sla: 95,
    lat: 41.2794,
    lon: 69.3418,
    photo: 'industrial-park-2-2',
    gallery: ['industrial-park-2-2', 'industrial-park-2-4', 'industrial-park-2'],
    manager: 'Ravshan Xolmatov',
    managerPhone: '+998 90 265 78 90',
    status: 'ACTIVE',
    amenities: [
      'Yuk ko‘taruvchi platformalar',
      'Temir yo‘l tarmog‘iga chiqish',
      '24/7 qo‘riqlash',
      'Yong‘inga qarshi tizim',
      'Katta yuk avtomobillari uchun yo‘l',
    ],
    equipment: ['Yuk lifti (2)', 'Generator', 'Kran (2)', 'CCTV', 'Yong‘in gidranti'],
  },
  {
    id: 'b-09',
    code: 'BIN-0009',
    name: 'Chilonzor Plaza',
    slug: 'chilonzor-plaza',
    type: 'Ofis binosi',
    city: 'Toshkent',
    district: 'Chilonzor tumani',
    street: 'Qatortol ko‘chasi 60',
    buildYear: 2017,
    buildingClass: 'B+ klass',
    floors: 9,
    undergroundFloors: 1,
    monthlyRevenue: 1264000000,
    sla: 94,
    lat: 41.2831,
    lon: 69.2043,
    photo: 'urban-office-2',
    gallery: ['urban-office-2', 'urban-office-3', 'urban-office'],
    manager: 'Zebo Nazarova',
    managerPhone: '+998 90 384 21 07',
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
  {
    id: 'b-10',
    code: 'BIN-0010',
    name: 'Nurafshon Residence',
    slug: 'nurafshon-residence',
    type: 'Turar joy',
    city: 'Toshkent',
    district: 'Mirzo Ulug‘bek tumani',
    street: 'Buyuk Ipak Yo‘li ko‘chasi 128',
    buildYear: 2024,
    buildingClass: 'A klass',
    floors: 14,
    undergroundFloors: 2,
    monthlyRevenue: 2016000000,
    sla: 95,
    lat: 41.3305,
    lon: 69.3358,
    photo: 'harmony-residence',
    gallery: ['harmony-residence'],
    manager: 'Kamola Rasulova',
    managerPhone: '+998 90 517 63 24',
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
    id: 'b-11',
    code: 'BIN-0011',
    name: 'Sergeli Logistik Terminal',
    slug: 'sergeli-logistik-terminal',
    type: 'Ombor / logistika',
    city: 'Toshkent',
    district: 'Sergeli tumani',
    street: 'Yangi Sergeli ko‘chasi 8',
    buildYear: 2022,
    buildingClass: 'B+ klass',
    floors: 2,
    undergroundFloors: 0,
    monthlyRevenue: 1360000000,
    sla: 96,
    lat: 41.2208,
    lon: 69.2276,
    photo: 'industrial-park-2-3',
    gallery: ['industrial-park-2-3', 'industrial-park-2-2', 'industrial-park-2'],
    manager: 'Farrux Sobirov',
    managerPhone: '+998 90 629 14 38',
    status: 'ACTIVE',
    amenities: [
      'Yuk ko‘taruvchi platformalar',
      'Sovutkichli saqlash zonasi',
      '24/7 qo‘riqlash',
      'Yong‘inga qarshi tizim',
      'Katta yuk avtomobillari uchun yo‘l',
    ],
    equipment: ['Yuk lifti (3)', 'Generator', 'Kran (3)', 'CCTV', 'Yong‘in gidranti'],
  },
  {
    id: 'b-12',
    code: 'BIN-0012',
    name: 'Olmazor Business Hub',
    slug: 'olmazor-business-hub',
    type: 'Biznes markaz',
    city: 'Toshkent',
    district: 'Olmazor tumani',
    street: 'Farobiy ko‘chasi 241',
    buildYear: 2020,
    buildingClass: 'B+ klass',
    floors: 10,
    undergroundFloors: 1,
    monthlyRevenue: 1521000000,
    sla: 93,
    lat: 41.3487,
    lon: 69.2168,
    photo: 'green-business-center-3',
    gallery: ['green-business-center-3', 'green-business-center', 'interior-office'],
    manager: 'Aziz Norqulov',
    managerPhone: '+998 90 743 55 19',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yuqori tezlikdagi internet',
      'Konferens zal',
      'Yer usti parkovka',
      'Yong‘inga qarshi tizim',
    ],
    equipment: ['Lift (4)', 'Generator', 'Yong‘in signalizatsiyasi', 'Suv nasosi', 'CCTV'],
  },
  {
    id: 'b-13',
    code: 'BIN-0013',
    name: 'Uchtepa Savdo Markazi',
    slug: 'uchtepa-savdo-markazi',
    type: 'Savdo markaz',
    city: 'Toshkent',
    district: 'Uchtepa tumani',
    street: 'Chinobod ko‘chasi 4',
    buildYear: 2019,
    buildingClass: 'B klass',
    floors: 3,
    undergroundFloors: 0,
    monthlyRevenue: 883000000,
    sla: 93,
    lat: 41.2925,
    lon: 69.1706,
    photo: 'mega-mall-3',
    gallery: ['mega-mall-3', 'mega-mall-2', 'mega-mall'],
    manager: 'Malika Ergasheva',
    managerPhone: '+998 90 856 40 71',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yer usti parkovka',
      'Markaziy sovitish',
      'Bolalar o‘yin maydoni',
      'Yong‘inga qarshi tizim',
    ],
    equipment: ['Lift (2)', 'Eskalator (4)', 'Generator', 'CCTV', 'Havo tozalash tizimi'],
  },
  {
    id: 'b-14',
    code: 'BIN-0014',
    name: 'Bektemir Sanoat Ombori',
    slug: 'bektemir-sanoat-ombori',
    type: 'Ombor / logistika',
    city: 'Toshkent',
    district: 'Bektemir tumani',
    street: 'Temiryo‘lchilar ko‘chasi 9',
    buildYear: 2016,
    buildingClass: 'C klass',
    floors: 1,
    undergroundFloors: 0,
    monthlyRevenue: 615000000,
    sla: 92,
    lat: 41.2087,
    lon: 69.3402,
    photo: 'industrial-park-2-4',
    gallery: ['industrial-park-2-4', 'industrial-park-2-3', 'industrial-park-2'],
    manager: 'Ulug‘bek Sattorov',
    managerPhone: '+998 90 917 26 83',
    status: 'ACTIVE',
    amenities: [
      'Yuk ko‘taruvchi platformalar',
      'Ochiq saqlash maydoni',
      '24/7 qo‘riqlash',
      'Yong‘inga qarshi tizim',
      'Katta yuk avtomobillari uchun yo‘l',
    ],
    equipment: ['Yuk lifti (1)', 'Generator', 'Kran (2)', 'CCTV', 'Yong‘in gidranti'],
  },
  {
    id: 'b-15',
    code: 'BIN-0015',
    name: 'Mirobod Office Park',
    slug: 'mirobod-office-park',
    type: 'Ofis binosi',
    city: 'Toshkent',
    district: 'Mirobod tumani',
    street: 'Nukus ko‘chasi 34',
    buildYear: 2023,
    buildingClass: 'A klass',
    floors: 11,
    undergroundFloors: 2,
    monthlyRevenue: 1584000000,
    sla: 97,
    lat: 41.2947,
    lon: 69.2718,
    photo: 'urban-office-3',
    gallery: ['urban-office-3', 'urban-office-4', 'interior-office'],
    manager: 'Dilnoza Mahmudova',
    managerPhone: '+998 90 431 09 65',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yuqori tezlikdagi internet',
      'Konferens zal',
      'Yer osti parkovka',
      'Markaziy isitish va sovitish',
    ],
    equipment: ['Lift (4)', 'Generator', 'Yong‘in signalizatsiyasi', 'Suv nasosi', 'CCTV'],
  },
  {
    id: 'b-16',
    code: 'BIN-0016',
    name: 'Yakkasaroy Atrium',
    slug: 'yakkasaroy-atrium',
    type: 'Biznes markaz',
    city: 'Toshkent',
    district: 'Yakkasaroy tumani',
    street: 'Bobur ko‘chasi 27',
    buildYear: 2021,
    buildingClass: 'A klass',
    floors: 13,
    undergroundFloors: 2,
    monthlyRevenue: 1871000000,
    sla: 96,
    lat: 41.2762,
    lon: 69.2437,
    photo: 'green-business-center',
    gallery: ['green-business-center', 'green-business-center-2', 'interior-office'],
    manager: 'Behzod Qodirov',
    managerPhone: '+998 90 268 91 47',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yuqori tezlikdagi internet',
      'Markaziy isitish va sovitish',
      'Yer osti parkovka',
      'Yong‘inga qarshi tizim',
    ],
    equipment: ['Lift (5)', 'Generator', 'Yong‘in signalizatsiyasi', 'Suv nasosi', 'CCTV'],
  },
  {
    id: 'b-17',
    code: 'BIN-0017',
    name: 'Zangiota Logistics Park',
    slug: 'zangiota-logistics-park',
    type: 'Ombor / logistika',
    city: 'Toshkent viloyati',
    district: 'Zangiota tumani',
    street: 'Nazarbek ko‘chasi 3',
    buildYear: 2023,
    buildingClass: 'B+ klass',
    floors: 2,
    undergroundFloors: 0,
    monthlyRevenue: 1680000000,
    sla: 96,
    lat: 41.2296,
    lon: 69.1042,
    photo: 'industrial-park-2',
    gallery: ['industrial-park-2', 'industrial-park-2-2', 'industrial-park-2-4'],
    manager: 'Sanjar Ochilov',
    managerPhone: '+998 90 592 37 60',
    status: 'ACTIVE',
    amenities: [
      'Yuk ko‘taruvchi platformalar',
      'Kran tizimi',
      '24/7 qo‘riqlash',
      'Yong‘inga qarshi tizim',
      'Katta yuk avtomobillari uchun yo‘l',
    ],
    equipment: ['Yuk lifti (3)', 'Generator', 'Kran (4)', 'CCTV', 'Yong‘in gidranti'],
  },
  {
    id: 'b-18',
    code: 'BIN-0018',
    name: 'Qibray Business Park',
    slug: 'qibray-business-park',
    type: 'Ofis binosi',
    city: 'Toshkent viloyati',
    district: 'Qibray tumani',
    street: 'Do‘stlik ko‘chasi 14',
    buildYear: 2018,
    buildingClass: 'B klass',
    floors: 6,
    undergroundFloors: 0,
    monthlyRevenue: 725000000,
    sla: 93,
    lat: 41.3892,
    lon: 69.5187,
    photo: 'urban-office-4',
    gallery: ['urban-office-4', 'urban-office-2', 'urban-office'],
    manager: 'Nodira Yusupova',
    managerPhone: '+998 90 305 84 22',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yuqori tezlikdagi internet',
      'Yer usti parkovka',
      'Oshxona va dam olish zonasi',
      'Markaziy isitish',
    ],
    equipment: ['Lift (2)', 'Generator', 'Yong‘in signalizatsiyasi', 'CCTV'],
  },
  {
    id: 'b-19',
    code: 'BIN-0019',
    name: 'Yashnobod Residence',
    slug: 'yashnobod-residence',
    type: 'Turar joy',
    city: 'Toshkent',
    district: 'Yashnobod tumani',
    street: 'Aviasozlar ko‘chasi 12',
    buildYear: 2022,
    buildingClass: 'B+ klass',
    floors: 12,
    undergroundFloors: 1,
    monthlyRevenue: 1392000000,
    sla: 94,
    lat: 41.2958,
    lon: 69.3216,
    photo: 'harmony-residence',
    gallery: ['harmony-residence'],
    manager: 'Gulnora Islomova',
    managerPhone: '+998 90 640 73 15',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yer osti parkovka',
      'Bolalar maydonchasi',
      'Yopiq hovli',
      'Markaziy isitish',
    ],
    equipment: ['Lift (3)', 'Generator', 'Yong‘in signalizatsiyasi', 'Suv nasosi', 'CCTV'],
  },
  {
    id: 'b-20',
    code: 'BIN-0020',
    name: 'Shayxontohur Ofis Markazi',
    slug: 'shayxontohur-ofis-markazi',
    type: 'Ofis binosi',
    city: 'Toshkent',
    district: 'Shayxontohur tumani',
    street: 'Furqat ko‘chasi 18',
    buildYear: 2015,
    buildingClass: 'B klass',
    floors: 7,
    undergroundFloors: 1,
    monthlyRevenue: 787000000,
    sla: 93,
    lat: 41.3162,
    lon: 69.2287,
    photo: 'urban-office',
    gallery: ['urban-office', 'urban-office-2', 'interior-office'],
    manager: 'Anvar Tursunov',
    managerPhone: '+998 90 827 16 94',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yuqori tezlikdagi internet',
      'Yer usti parkovka',
      'Konferens zal',
      'Markaziy isitish',
    ],
    equipment: ['Lift (2)', 'Generator', 'Yong‘in signalizatsiyasi', 'CCTV'],
  },
  {
    id: 'b-21',
    code: 'BIN-0021',
    name: 'Sergeli City Mall',
    slug: 'sergeli-city-mall',
    type: 'Savdo markaz',
    city: 'Toshkent',
    district: 'Sergeli tumani',
    street: 'Sergeli ko‘chasi 21',
    buildYear: 2024,
    buildingClass: 'A klass',
    floors: 4,
    undergroundFloors: 1,
    monthlyRevenue: 2130000000,
    sla: 97,
    lat: 41.2334,
    lon: 69.2451,
    photo: 'mega-mall-4',
    gallery: ['mega-mall-4', 'mega-mall-3', 'mega-mall-2'],
    manager: 'Sherzod Abdullayev',
    managerPhone: '+998 90 719 58 03',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yer osti parkovka',
      'Markaziy sovitish',
      'Eskalatorlar',
      'Yong‘inga qarshi tizim',
    ],
    equipment: ['Lift (5)', 'Eskalator (8)', 'Generator', 'CCTV', 'Havo tozalash tizimi'],
  },
  {
    id: 'b-22',
    code: 'BIN-0022',
    name: 'Bog‘ishamol Residence',
    slug: 'bogishamol-residence',
    type: 'Turar joy',
    city: 'Toshkent',
    district: 'Yunusobod tumani',
    street: 'Bog‘ishamol ko‘chasi 31',
    buildYear: 2025,
    buildingClass: 'A klass',
    floors: 17,
    undergroundFloors: 2,
    monthlyRevenue: 1904000000,
    sla: 96,
    lat: 41.3634,
    lon: 69.3021,
    photo: 'harmony-residence',
    gallery: ['harmony-residence'],
    manager: 'Lola Yo‘ldosheva',
    managerPhone: '+998 90 146 27 58',
    status: 'ACTIVE',
    amenities: [
      '24/7 qo‘riqlash',
      'Yer osti parkovka',
      'Bolalar maydonchasi',
      'Fitnes zal',
      'Markaziy isitish va sovitish',
    ],
    equipment: ['Lift (4)', 'Generator', 'Yong‘in signalizatsiyasi', 'Suv nasosi', 'CCTV'],
  },
]

/**
 * Bino reyestri: pasport ma’lumoti seed ro‘yxatidan, jamlar esa unit va
 * hisob-faktura reyestrlaridan keladi.
 */
export const BUILDINGS: Building[] = reactive(BUILDING_SEEDS.map(withRegistryStats))

const sumBy = (pick: (b: Building) => number) => BUILDINGS.reduce((s, b) => s + pick(b), 0)

/** Maydon bo‘yicha o‘lchangan o‘rtacha: yirik obyekt umumiy natijaga ko‘proq ta’sir qiladi */
function glaWeighted(pick: (b: Building) => number) {
  const gla = sumBy((b) => b.gla)
  return gla ? Math.round(sumBy((b) => pick(b) * b.gla) / gla) : 0
}

/**
 * Portfel bandligi bino ichidagi bilan bir xil formulada hisoblanadi: jami
 * maydondan bo‘sh maydon chegiriladi. Yaxlitlangan foizlarning o‘rtachasi
 * emas, shuning uchun boshqaruv paneli, hisobotlar va maydon diagrammasi
 * bitta raqamni ko‘rsatadi.
 */
function portfolioOccupancy() {
  const gla = sumBy((b) => b.gla)
  return gla ? Math.round(((gla - sumBy((b) => b.vacantArea)) / gla) * 100) : 0
}

export interface PortfolioTotals {
  buildings: number
  gla: number
  vacantArea: number
  revenue: number
  debt: number
  units: number
  occupiedUnits: number
  vacantUnits: number
  serviceRequests: number
  occupancy: number
  sla: number
}

/**
 * Portfel ko‘rsatkichlari reyestrdan hisoblanadi, shuning uchun yangi obyekt
 * qo‘shilganda ham, shartnoma faollashtirilib bino statistikasi qayta
 * hisoblanganda ham barcha sahifadagi jamlar avtomatik to‘g‘ri qoladi.
 */
export function portfolioTotals(): PortfolioTotals {
  return {
    buildings: BUILDINGS.length,
    gla: sumBy((b) => b.gla),
    vacantArea: sumBy((b) => b.vacantArea),
    revenue: sumBy((b) => b.monthlyRevenue),
    debt: sumBy((b) => b.debt),
    units: sumBy((b) => b.units),
    occupiedUnits: sumBy((b) => b.occupiedUnits),
    vacantUnits: sumBy((b) => b.vacantUnits),
    serviceRequests: sumBy((b) => b.serviceRequests),
    occupancy: portfolioOccupancy(),
    sla: glaWeighted((b) => b.sla),
  }
}

/**
 * Bir martalik suratga olish emas: har bir maydon o‘qilganda jamlar
 * reyestrdan yangidan yig‘iladi.
 */
export const PORTFOLIO_TOTALS: PortfolioTotals = {
  get buildings() {
    return BUILDINGS.length
  },
  get gla() {
    return sumBy((b) => b.gla)
  },
  get vacantArea() {
    return sumBy((b) => b.vacantArea)
  },
  get revenue() {
    return sumBy((b) => b.monthlyRevenue)
  },
  get debt() {
    return sumBy((b) => b.debt)
  },
  get units() {
    return sumBy((b) => b.units)
  },
  get occupiedUnits() {
    return sumBy((b) => b.occupiedUnits)
  },
  get vacantUnits() {
    return sumBy((b) => b.vacantUnits)
  },
  get serviceRequests() {
    return sumBy((b) => b.serviceRequests)
  },
  get occupancy() {
    return portfolioOccupancy()
  },
  get sla() {
    return glaWeighted((b) => b.sla)
  },
}

export function buildingById(id: string) {
  return BUILDINGS.find((b) => b.id === id)
}

export function buildingBySlug(slug: string) {
  return BUILDINGS.find((b) => b.slug === slug)
}

// ---------------------------------------------------------------------------
// Dinamika oynasi

const TREND_MONTHS = [
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

/**
 * Hisobot davri tizim sanasidan olinadi, qo‘lda qotirilmaydi: grafik oynasi
 * doim joriy oyda tugaydi. `month`: noldan boshlanadigan indeks,
 * `TREND_MONTHS` bilan bir xil.
 */
export const REPORT_PERIOD = currentReportPeriod()

function currentReportPeriod(): { year: number; month: number } {
  const [year, month] = todayIso().split('-')
  return { year: Number(year), month: Number(month) - 1 }
}

/** Grafik oynasi: har bir variant joriy hisobot oyida tugaydi */
export const TREND_SPANS = [
  { value: '3', label: 'So‘nggi 3 oy' },
  { value: '6', label: 'So‘nggi 6 oy' },
  { value: '12', label: 'So‘nggi 12 oy' },
]

/**
 * Reyestr obyektlarning joriy holatini saqlaydi, oylik o‘lchov tarixi
 * yuritilmaydi. Shuning uchun panellardagi dinamika grafiklari va mikro
 * grafiklar joriy qiymatga bog‘langan trend indeksidan foydalanadi:
 * indeksning oxirgi qadami doim 1, ya’ni grafikning oxirgi nuqtasi
 * yonidagi KPI kartadagi qiymatning aynan o‘zi.
 */
export const TREND_INDEX = {
  gla: [0.95, 0.957, 0.963, 0.968, 0.973, 0.978, 0.982, 0.986, 0.99, 0.993, 0.997, 1],
  sla: [0.938, 0.948, 0.948, 0.958, 0.958, 0.969, 0.969, 0.979, 0.979, 0.99, 0.99, 1],
  occupancy: [0.908, 0.92, 0.931, 0.931, 0.943, 0.954, 0.954, 0.966, 0.977, 0.977, 0.989, 1],
  vacantArea: [1.35, 1.31, 1.27, 1.24, 1.2, 1.17, 1.13, 1.1, 1.07, 1.05, 1.02, 1],
  revenue: [0.742, 0.768, 0.795, 0.818, 0.842, 0.869, 0.895, 0.909, 0.928, 0.941, 0.965, 1],
  debt: [1.62, 1.556, 1.498, 1.447, 1.402, 1.363, 1.296, 1.243, 1.184, 1.112, 1.048, 1],
  service: [1.42, 1.38, 1.34, 1.3, 1.27, 1.24, 1.19, 1.14, 1.11, 1.09, 1.05, 1],
}

export type TrendKey = keyof typeof TREND_INDEX

/**
 * Oyna oxiri joriy hisobot oyi bo‘ladigan oy nomlari. Yil har bir yorliqda
 * ko‘rsatiladi: aks holda oyna yil chegarasidan o‘tganda qaysi yil chizilgani
 * noaniq qoladi.
 */
export function trendLabels(span: number): string[] {
  return Array.from({ length: span }, (_, i) => {
    const shifted = REPORT_PERIOD.month - (span - 1 - i)
    const year = REPORT_PERIOD.year + Math.floor(shifted / 12)
    const month = ((shifted % 12) + 12) % 12
    return `${TREND_MONTHS[month]} ${String(year).slice(2)}`
  })
}

/** Tanlangan oyna uchun indeks qadamlari */
export function trendWindow(key: TrendKey, span: number): number[] {
  return TREND_INDEX[key].slice(-span)
}

/** Joriy qiymatga bog‘langan grafik nuqtalari, oxirgisi qiymatning o‘zi */
export function trendValues(key: TrendKey, value: number, span: number, digits = 2): number[] {
  return trendWindow(key, span).map((f) => +(value * f).toFixed(digits))
}

/** Kartadagi mikro grafik: indeksning oxirgi besh qadami */
export function trendSpark(key: TrendKey, value: number): number[] {
  return trendValues(key, value, 5)
}

/** Oxirgi qadamdagi o‘zgarish, foizda: indeksning oxirgi qiymati doim 1 */
export function trendDelta(key: TrendKey): number {
  const list = TREND_INDEX[key]
  const prev = list[list.length - 2] ?? 1
  return +((1 / prev - 1) * 100).toFixed(1)
}

/** Grafik o‘lchov birligi KPI kartadagi «sumShort» bilan bir xil bo‘ladi */
export function moneyScale(value: number) {
  return Math.abs(value) >= 1_000_000_000
    ? { div: 1_000_000_000, unit: 'mlrd so‘m', digits: 2 }
    : { div: 1_000_000, unit: 'mln so‘m', digits: 1 }
}
