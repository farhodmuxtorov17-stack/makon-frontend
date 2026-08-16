import { ScheduleKind } from '@prisma/client'
import { addDays, addMonths, formatDmy, monthLabel } from '../../common/utils/dates'

/** To‘lov davriyligi va uning oylardagi qadami. */
export const PERIODICITY_MONTHS: Record<string, number> = {
  Oylik: 1,
  Choraklik: 3,
  Yillik: 12,
}

export const PERIODICITY_VALUES = Object.keys(PERIODICITY_MONTHS)

export interface OfferTerms {
  monthlyRent: number
  deposit: number
  /** Servis to‘lovi, so‘m / m² / oy */
  servicePerSqm: number
  periodicity: string
}

export interface SchedulePlanRow {
  kind: ScheduleKind
  label: string
  dueAt: Date
  months: number
  rent: number
  service: number
  total: number
  position: number
}

/** Servis to‘lovining oylik jami: tarif maydonga ko‘paytiriladi. */
export function serviceTotalOf(offer: OfferTerms, area: number): number {
  return Math.round(offer.servicePerSqm * area)
}

/**
 * To‘lov grafigi. Kirish qiymatlari o‘zgarganda grafik butunlay qayta
 * hisoblanadi, shuning uchun funksiya toza: hech qanday tashqi holatga
 * tayanmaydi.
 */
export function buildSchedule(
  offer: OfferTerms,
  request: { startDate: Date; term: number },
  area: number,
): SchedulePlanRow[] {
  const rows: SchedulePlanRow[] = []
  const service = serviceTotalOf(offer, area)
  const step = PERIODICITY_MONTHS[offer.periodicity] ?? 1
  const term = Math.max(1, Math.round(request.term))
  let position = 0

  if (offer.deposit > 0) {
    rows.push({
      kind: ScheduleKind.DEPOSIT,
      label: 'Kafolat depoziti',
      dueAt: request.startDate,
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
    const from = addMonths(request.startDate, passed)
    const to = addDays(addMonths(request.startDate, passed + months), -1)
    const rent = Math.round(offer.monthlyRent * months)
    const serviceSum = service * months

    rows.push({
      kind: ScheduleKind.RENT,
      label: months === 1 ? monthLabel(from) : `${formatDmy(from)} , ${formatDmy(to)}`,
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

export interface ScheduleTotals {
  deposit: number
  rent: number
  service: number
  total: number
  periods: number
}

export function scheduleTotals(rows: SchedulePlanRow[]): ScheduleTotals {
  const rent = rows.filter((row) => row.kind === ScheduleKind.RENT)
  return {
    deposit: rows
      .filter((row) => row.kind === ScheduleKind.DEPOSIT)
      .reduce((sum, row) => sum + row.total, 0),
    rent: rent.reduce((sum, row) => sum + row.rent, 0),
    service: rent.reduce((sum, row) => sum + row.service, 0),
    total: rent.reduce((sum, row) => sum + row.total, 0),
    periods: rent.length,
  }
}
