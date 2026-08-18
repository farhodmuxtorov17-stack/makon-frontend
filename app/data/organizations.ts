/**
 * Tashkilotlar reyestri: platformaning o‘z ma’lumotnomasi.
 *
 * STIR orqali kirish, ro‘yxatdan o‘tish va ariza formasi shu ro‘yxatdan
 * qidiradi. Yozuvlar tizim ichidagi hisoblar bilan bir xil bo‘lishi uchun
 * mavjud ijarachilarning rekvizitlari bu yerda ham saqlanadi.
 */

export type OrganizationType = 'Yuridik shaxs' | 'Yakka tartibdagi tadbirkor'

export interface Organization {
  /** To‘qqiz xonali soliq to‘lovchi identifikatsiya raqami */
  stir: string
  name: string
  /** Ro‘yxat va kartochkalarda ko‘rinadigan qisqa nom */
  shortName: string
  address: string
  director: string
  phone: string
  email: string
  type: OrganizationType
  bank: string
  /** Hisob raqami, yigirma xona */
  account: string
}

export const ORGANIZATIONS: Organization[] = [
  {
    stir: '307219645',
    name: 'Urban Office MCHJ',
    shortName: 'Urban Office',
    address: 'Toshkent shahri, Yunusobod tumani, Abdulla Qodiriy ko‘chasi 10',
    director: 'Dilshod Ergashev',
    phone: '+998 90 567 89 01',
    email: 'd.ergashev@urbanoffice.uz',
    type: 'Yuridik shaxs',
    bank: 'Ipoteka Bank ATIB, Toshkent shahar filiali',
    account: '2020 8000 3072 1964 5001',
  },
  {
    stir: '304552118',
    name: 'Tech Solutions UZB MChJ',
    shortName: 'Tech Solutions UZB',
    address: 'Toshkent shahri, Chilonzor tumani, Bunyodkor shoh ko‘chasi 3',
    director: 'Sanjar Aliyev',
    phone: '+998 90 771 22 33',
    email: 's.aliyev@techsolutions.uz',
    type: 'Yuridik shaxs',
    bank: 'Kapitalbank ATB, Chilonzor filiali',
    account: '2020 8000 3045 5211 8002',
  },
  {
    stir: '302640973',
    name: 'Mega Invest Group',
    shortName: 'Mega Invest',
    address: 'Toshkent viloyati, Yuqori Chirchiq tumani, Sanoat ko‘chasi 12',
    director: 'Aziz Nazarov',
    phone: '+998 90 882 44 55',
    email: 'a.nazarov@megainvest.uz',
    type: 'Yuridik shaxs',
    bank: 'Asakabank ATB, Toshkent viloyat filiali',
    account: '2020 8000 3026 4097 3003',
  },
  {
    stir: '303981264',
    name: 'Creative Agency',
    shortName: 'Creative Agency',
    address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
    director: 'Kamola Yusupova',
    phone: '+998 90 993 66 77',
    email: 'k.yusupova@creative.uz',
    type: 'Yuridik shaxs',
    bank: 'Hamkorbank ATB, Mirobod filiali',
    account: '2020 8000 3039 8126 4004',
  },
  {
    stir: '308156742',
    name: 'Global Logistics & Trans',
    shortName: 'Global Logistics',
    address: 'Toshkent viloyati, Zangiota tumani, Temiryo‘l ko‘chasi 4',
    director: 'Ulug‘bek Sobirov',
    phone: '+998 90 604 71 20',
    email: 'u.sobirov@globallogistics.uz',
    type: 'Yuridik shaxs',
    bank: 'Turonbank ATB, Zangiota filiali',
    account: '2020 8000 3081 5674 2005',
  },
  {
    stir: '301774508',
    name: 'Dream Retail',
    shortName: 'Dream Retail',
    address: 'Toshkent shahri, Shayxontohur tumani, Navoiy ko‘chasi 26',
    director: 'Farrux Xolmatov',
    phone: '+998 90 818 22 09',
    email: 'f.xolmatov@dreamretail.uz',
    type: 'Yuridik shaxs',
    bank: 'Xalq banki ATB, Shayxontohur filiali',
    account: '2020 8000 3017 7450 8006',
  },
  {
    stir: '305903617',
    name: 'FinTech Services',
    shortName: 'FinTech Services',
    address: 'Toshkent shahri, Mirobod tumani, Shahrisabz ko‘chasi 21',
    director: 'Rustam Qodirov',
    phone: '+998 90 909 31 42',
    email: 'r.qodirov@fintechservices.uz',
    type: 'Yuridik shaxs',
    bank: 'InFinBank ATB, Mirobod filiali',
    account: '2020 8000 3059 0361 7007',
  },
  {
    stir: '306118402',
    name: 'Makon Solutions MCHJ',
    shortName: 'Makon Solutions',
    address: 'Toshkent shahri, Mirobod tumani, Shahrisabz ko‘chasi 14',
    director: 'Bekzod Sultonov',
    phone: '+998 90 512 30 40',
    email: 'info@makonsolutions.uz',
    type: 'Yuridik shaxs',
    bank: 'Aloqabank ATB, Mirobod filiali',
    account: '2020 8000 3061 1840 2008',
  },
  {
    stir: '300462189',
    name: 'Grand Textile MCHJ',
    shortName: 'Grand Textile',
    address: 'Toshkent shahri, Yashnobod tumani, Farg‘ona yo‘li 118',
    director: 'Sherzod Ochilov',
    phone: '+998 90 330 55 18',
    email: 'info@grandtextile.uz',
    type: 'Yuridik shaxs',
    bank: 'Agrobank ATB, Yashnobod filiali',
    account: '2020 8000 3004 6218 9009',
  },
  {
    stir: '302118340',
    name: 'Silk Road Pharm MCHJ',
    shortName: 'Silk Road Pharm',
    address: 'Toshkent shahri, Uchtepa tumani, Qorasaroy ko‘chasi 45',
    director: 'Dilnoza Ergasheva',
    phone: '+998 90 745 60 33',
    email: 'office@silkroadpharm.uz',
    type: 'Yuridik shaxs',
    bank: 'Trastbank ATB, Uchtepa filiali',
    account: '2020 8000 3021 1834 0010',
  },
  {
    stir: '309220465',
    name: 'Nur Medical Center MCHJ',
    shortName: 'Nur Medical Center',
    address: 'Toshkent shahri, Yunusobod tumani, Amir Temur shoh ko‘chasi 108',
    director: 'Otabek Sattorov',
    phone: '+998 90 277 14 62',
    email: 'info@nurmedical.uz',
    type: 'Yuridik shaxs',
    bank: 'Davr Bank ATB, Yunusobod filiali',
    account: '2020 8000 3092 2046 5011',
  },
  {
    stir: '304671025',
    name: 'Sharq Media Group MCHJ',
    shortName: 'Sharq Media',
    address: 'Toshkent shahri, Mirzo Ulug‘bek tumani, Buyuk ipak yo‘li 12',
    director: 'Zafar Umarov',
    phone: '+998 90 188 40 27',
    email: 'z.umarov@sharqmedia.uz',
    type: 'Yuridik shaxs',
    bank: 'Universal Bank ATB, Mirzo Ulug‘bek filiali',
    account: '2020 8000 3046 7102 5012',
  },
  {
    stir: '445203917',
    name: 'Yakka tartibdagi tadbirkor Bekzod Rahimov',
    shortName: 'YaTT Bekzod Rahimov',
    address: 'Toshkent shahri, Sergeli tumani, Yangi Sergeli 7-mavze 21',
    director: 'Bekzod Rahimov',
    phone: '+998 90 350 71 84',
    email: 'b.rahimov@pochta.uz',
    type: 'Yakka tartibdagi tadbirkor',
    bank: 'Hamkorbank ATB, Sergeli filiali',
    account: '2020 8000 4452 0391 7013',
  },
  {
    stir: '462117805',
    name: 'Yakka tartibdagi tadbirkor Nodira Ismoilova',
    shortName: 'YaTT Nodira Ismoilova',
    address: 'Toshkent shahri, Olmazor tumani, Do‘rmon yo‘li 9',
    director: 'Nodira Ismoilova',
    phone: '+998 90 402 66 19',
    email: 'n.ismoilova@pochta.uz',
    type: 'Yakka tartibdagi tadbirkor',
    bank: 'Kapitalbank ATB, Olmazor filiali',
    account: '2020 8000 4621 1780 5014',
  },
]

/** Faqat raqamlar qoldiriladi, maska va solishtirish uchun */
export function stirDigits(value: string): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 9)
}

/** "307219645" → "307 219 645" */
export function formatStir(value: string): string {
  const d = stirDigits(value)
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' ')
}

/**
 * STIR bo‘yicha tashkilotni topadi. Kiritilgan qiymat bo‘sh joy yoki
 * chiziqcha bilan yozilgan bo‘lsa ham qabul qilinadi.
 */
export function organizationByStir(stir: string): Organization | undefined {
  const digits = stirDigits(stir)
  if (digits.length !== 9) return undefined
  return ORGANIZATIONS.find((o) => o.stir === digits)
}

/** "+998 90 567 89 01" → "905678901" */
export function phoneDigitsOf(phone: string): string {
  const raw = String(phone ?? '').replace(/\D/g, '')
  return raw.startsWith('998') ? raw.slice(3) : raw
}
