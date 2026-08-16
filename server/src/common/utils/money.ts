import { Prisma } from '@prisma/client'

/** Prisma `Decimal` qiymatini oddiy songa aylantiradi. */
export function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

/** Ming ajratgichli ko‘rinish: 12 540 000. */
export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Audit va hujjat matnlari uchun summa ko‘rinishi. */
export function formatMoney(value: number): string {
  return `${formatNumber(value)} so‘m`
}
