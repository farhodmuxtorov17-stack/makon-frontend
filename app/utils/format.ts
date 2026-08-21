/** 12540000 → "12 540 000" (o‘zbek yozuvida razryadlar bo‘sh joy bilan ajratiladi) */
export function num(value: number, fractionDigits = 0): string {
  return value
    .toLocaleString('ru-RU', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    .replace(/ /g, ' ')
    .replace(/,/g, '.')
}

/** 12540000 → "12 540 000 so‘m" */
export function sum(value: number): string {
  return `${num(value)} so‘m`
}

/** Katta summalarni qisqartiradi: 12540000000 → "12.54 mlrd so‘m" */
export function sumShort(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${num(value / 1_000_000_000, 2)} mlrd so‘m`
  if (Math.abs(value) >= 1_000_000) return `${num(value / 1_000_000, 1)} mln so‘m`
  return sum(value)
}

/** 125.4 → "125.40 m²" */
export function area(value: number): string {
  return `${num(value, 2)} m²`
}

export function percent(value: number, fractionDigits = 0): string {
  return `${num(value, fractionDigits)}%`
}

const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
]

/** "2025-05-18" yoki "2025-05-18 08:40" → ["2025","05","18"] */
function parts(iso: string): [string, string, string] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  return m ? [m[1]!, m[2]!, m[3]!] : null
}

/** "2025-05-18" → "18-may, 2025" */
export function dateLong(iso: string): string {
  const p = parts(iso)
  if (!p) return iso
  return `${Number(p[2])}-${MONTHS[Number(p[1]) - 1]}, ${p[0]}`
}

/** "2025-05-18 08:40" → "18.05.2025" */
export function dateShort(iso: string): string {
  const p = parts(iso)
  if (!p) return iso
  return `${p[2]}.${p[1]}.${p[0]}`
}

/** "2025-05-18 08:40" → "08:40" (vaqt bo‘lmasa bo‘sh qator) */
export function timeOf(iso: string): string {
  const m = /\b(\d{2}:\d{2})\b/.exec(iso)
  return m ? m[1]! : ''
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Sanani mahalliy vaqt zonasida ISO ko‘rinishga o‘giradi.
 * `toISOString()` UTC ga o‘tkazadi va UTC+5 da kunni bir kun orqaga suradi,
 * shuning uchun sana yorliqlari uchun faqat shu funksiya ishlatiladi.
 */
export function isoOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Bugungi sana ISO ko‘rinishida: "2026-08-18" */
export function todayIso(): string {
  return isoOf(new Date())
}

/** Bugundan `days` kun oldingi (manfiy) yoki keyingi (musbat) sana */
export function isoShift(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return isoOf(d)
}

/** Bugundan `months` oy keyingi sananing boshi: hisob davri yorlig‘i uchun */
export function monthShift(months: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  return isoOf(d)
}

/** "2026-08-18" → "Avgust 2026" (hisob davri yorlig‘i) */
export function monthTitle(iso: string): string {
  const p = parts(iso)
  if (!p) return iso
  const name = MONTHS[Number(p[1]) - 1] ?? ''
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${p[0]}`
}
