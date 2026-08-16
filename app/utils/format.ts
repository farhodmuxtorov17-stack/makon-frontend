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
