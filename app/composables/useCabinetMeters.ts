/**
 * Kabinet hisoblagichlari bitta umumiy ro‘yxatdan o‘qiladi.
 *
 * Bosh sahifadagi qisqa ko‘rinish ham, «Hisoblagichlar» bo‘limi ham aynan shu
 * yozuvlarni ko‘rsatadi: kiritilgan ko‘rsatkich ikkala ekranda darhol
 * yangilanadi va sahifadan chiqilganda yo‘qolmaydi. Ilgari bosh sahifa o‘z
 * ichidagi alohida ro‘yxatdan chizar, shuning uchun qiymatlar «Hisoblagichlar»
 * sahifasidagi qiymatlarga mos kelmasdi.
 */
import { UNITS } from '~/data/units'

export interface CabinetMeter {
  id: string
  code: string
  type: string
  serial: string
  unit: string
  icon: string
  tone: 'brand' | 'warn' | 'danger'
  /** Unit ichidagi joy: unit kodi ko‘rsatishda qo‘shiladi */
  place: string
  lastReading: number
  previousReading: number
  readAt: string
  verifyAt: string
  status: 'ACTIVE' | 'MAINTENANCE'
  labels: string[]
  history: number[]
}

/**
 * Hisoblagich turi va joylashuvi ma’lumotda o‘zbekcha qiymat sifatida
 * saqlanadi: qiymat o‘zgarmaydi, faqat ko‘rinadigan nom lug‘atdan olinadi.
 */
const TYPE_KEY: Record<string, string> = {
  Suv: 'meterType.water',
  Elektr: 'meterType.electricity',
  Issiqlik: 'meterType.heating',
}

const PLACE_KEY: Record<string, string> = {
  'sanuzel tuguni': 'meterPlace.water',
  'kirish shchiti': 'meterPlace.electricity',
  'issiqlik tuguni': 'meterPlace.heating',
}

const MONTH_NAMES = [
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

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Ko‘rsatkich har oyning 18-sanasida qayd etiladi: oxirgi shunday sana */
function lastReadingDate() {
  const d = new Date()
  if (d.getDate() < 18) d.setMonth(d.getMonth() - 1)
  d.setDate(18)
  return isoOf(d)
}

/** Bugungi oydan `offset` oy siljigan oy nomi */
function monthName(offset: number) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return MONTH_NAMES[d.getMonth()] ?? ''
}

function shiftMonths(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setMonth(d.getMonth() + months)
  return isoOf(d)
}

function defaultMeters(): CabinetMeter[] {
  const readAt = lastReadingDate()
  const labels = [-4, -3, -2, -1, 0].map(monthName)
  return [
    {
      id: 'cm-suv',
      code: 'MTR-SV-0014',
      type: 'Suv',
      serial: 'SV-442716',
      unit: 'm³',
      icon: 'meter',
      tone: 'brand',
      place: 'sanuzel tuguni',
      lastReading: 125.4,
      previousReading: 118.2,
      readAt,
      verifyAt: shiftMonths(readAt, 5),
      status: 'ACTIVE',
      labels: [...labels],
      history: [6.4, 6.9, 7.4, 6.8, 7.2],
    },
    {
      id: 'cm-elektr',
      code: 'MTR-EL-0032',
      type: 'Elektr',
      serial: 'EL-884733',
      unit: 'kVt-soat',
      icon: 'sparkle',
      tone: 'warn',
      place: 'kirish shchiti',
      lastReading: 1245.6,
      previousReading: 1198.3,
      readAt,
      verifyAt: shiftMonths(readAt, 7),
      status: 'ACTIVE',
      labels: [...labels],
      history: [41.2, 44.6, 46.1, 43.8, 47.3],
    },
    {
      id: 'cm-issiqlik',
      code: 'MTR-IS-0009',
      type: 'Issiqlik',
      serial: 'IS-770418',
      unit: 'Gkal',
      icon: 'refresh',
      tone: 'danger',
      place: 'issiqlik tuguni',
      lastReading: 63.2,
      previousReading: 58.1,
      readAt,
      verifyAt: shiftMonths(readAt, 6),
      status: 'ACTIVE',
      labels: [...labels],
      history: [9.8, 8.4, 6.9, 5.6, 5.1],
    },
  ]
}

export function useCabinetMeters() {
  const auth = useAuthStore()
  const { t } = useI18n()
  const { monthName: monthTitleOf } = useAppLabels()

  /**
   * Holat `cabinet-meters` kalitida saqlanadi: qaysi sahifa birinchi ochilsa
   * ham ro‘yxat bir marta tayyorlanadi va keyin o‘sha nusxa ishlatiladi.
   */
  const all = useState<CabinetMeter[]>('cabinet-meters', defaultMeters)

  /** Kabinet faqat kirgan foydalanuvchining tashkiloti bilan ishlaydi */
  const organization = computed(() => auth.user?.organization ?? '')

  const myUnits = computed(() =>
    UNITS.filter((u) => organization.value && u.tenant === organization.value),
  )

  const myUnit = computed(() => myUnits.value[0] ?? null)

  /**
   * Ijarachiga faqat o‘z maydonidagi hisoblagichlar ko‘rinadi: maydon
   * biriktirilmagan bo‘lsa ro‘yxat bo‘sh qoladi.
   */
  const meters = computed<CabinetMeter[]>(() => (myUnit.value ? all.value : []))

  function typeLabel(value: string) {
    const key = TYPE_KEY[value]
    return key ? t(key) : value
  }

  function placeLabel(value: string) {
    const key = PLACE_KEY[value]
    return key ? t(key) : value
  }

  /** Joylashuv unit kodidan yig‘iladi, qattiq yozilmaydi */
  function locationOf(m: CabinetMeter) {
    return myUnit.value
      ? t('cab.meterLocation', { unit: myUnit.value.code, place: placeLabel(m.place) })
      : placeLabel(m.place)
  }

  function consumption(m: CabinetMeter) {
    return Math.round((m.lastReading - m.previousReading) * 100) / 100
  }

  /** Grafik yorliqlari ma’lumotda o‘zbekcha saqlanadi, ekranda tarjima qilinadi */
  function monthLabel(name: string) {
    const index = MONTH_NAMES.indexOf(name)
    return index < 0 ? name : monthTitleOf(index + 1)
  }

  return {
    meters,
    myUnit,
    typeLabel,
    placeLabel,
    locationOf,
    consumption,
    monthLabel,
    monthName,
  }
}
