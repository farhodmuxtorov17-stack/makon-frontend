import { Injectable } from '@nestjs/common'
import { ScheduleKind } from '@prisma/client'
import { addDays, addMonths, formatDmy } from '../../common/utils/dates'
import { formatMoney } from '../../common/utils/money'
import type { OfferTerms, SchedulePlanRow } from './schedule.builder'
import { scheduleTotals, serviceTotalOf } from './schedule.builder'

export interface ContractParty {
  role: string
  name: string
  tin: string
  director: string
  phone: string
  email: string
  address: string
}

export interface ContractBody {
  code: string
  composedAt: string
  startsAt: string
  endsAt: string
  landlord: ContractParty
  tenant: ContractParty
  object: Array<{ label: string; value: string }>
  terms: Array<{ label: string; value: string }>
  clauses: Array<{ title: string; text: string }>
  schedule: Array<{ label: string; dueAt: string; total: number }>
}

export interface ComposeInput {
  code: string
  offer: OfferTerms
  schedule: SchedulePlanRow[]
  startDate: Date
  term: number
  area: number
  unitCode: string
  floor: number
  usage: string
  buildingName: string
  buildingAddress: string
  landlord: ContractParty
  tenant: ContractParty
}

/**
 * Shartnoma qoralamasi. Moliya tasdiqlagach tizim uni avtomatik tuzadi:
 * tomonlar, obyekt, moliyaviy shartlar, to‘lov grafigi va bandlar.
 */
@Injectable()
export class ContractComposer {
  compose(input: ComposeInput): { body: ContractBody; startsAt: Date; endsAt: Date; amount: number } {
    const startsAt = input.startDate
    const endsAt = addDays(addMonths(startsAt, input.term), -1)
    const service = serviceTotalOf(input.offer, input.area)
    const totals = scheduleTotals(input.schedule)

    const body: ContractBody = {
      code: input.code,
      composedAt: formatDmy(new Date()),
      startsAt: formatDmy(startsAt),
      endsAt: formatDmy(endsAt),
      landlord: input.landlord,
      tenant: input.tenant,
      object: [
        { label: 'Obyekt', value: input.buildingName },
        { label: 'Manzil', value: input.buildingAddress },
        { label: 'Unit raqami', value: input.unitCode },
        { label: 'Qavat', value: `${input.floor}-qavat` },
        { label: 'Maydon', value: `${input.area.toFixed(2)} m²` },
        { label: 'Foydalanish turi', value: input.usage },
      ],
      terms: [
        { label: 'Oylik ijara narxi', value: formatMoney(input.offer.monthlyRent) },
        { label: 'Kafolat depoziti', value: formatMoney(input.offer.deposit) },
        {
          label: 'Servis to‘lovi',
          value: `${formatMoney(input.offer.servicePerSqm)} / m² / oy, jami ${formatMoney(service)}`,
        },
        { label: 'To‘lov davriyligi', value: input.offer.periodicity },
        { label: 'Muddat', value: `${input.term} oy` },
        { label: 'Boshlanish sanasi', value: formatDmy(startsAt) },
        { label: 'Tugash sanasi', value: formatDmy(endsAt) },
        { label: 'Shartnoma bo‘yicha jami summa', value: formatMoney(totals.total) },
      ],
      clauses: [
        {
          title: 'Shartnoma predmeti',
          text:
            `Ijaraga beruvchi ${input.buildingName} binosidagi ${input.unitCode}-unitni ` +
            `(${input.area.toFixed(2)} m²) Ijarachiga vaqtinchalik egalik va foydalanishga ` +
            'topshiradi, Ijarachi esa belgilangan to‘lovlarni o‘z vaqtida amalga oshiradi.',
        },
        {
          title: 'To‘lov tartibi',
          text:
            `To‘lovlar ${input.offer.periodicity.toLowerCase()} tartibda, har bir davr ` +
            'boshlanishidan oldin ilova qilingan grafik bo‘yicha amalga oshiriladi. Servis ' +
            'to‘lovi maydonga nisbatan hisoblanadi va ijara to‘lovi bilan birga undiriladi.',
        },
        {
          title: 'Kafolat depoziti',
          text:
            'Ijarachi shartnoma imzolangan sanadan boshlab 5 bank kuni ichida ' +
            `${formatMoney(input.offer.deposit)} miqdorida kafolat depozitini o‘tkazadi. ` +
            'Depozit shartnoma tugagach, qarzdorlik bo‘lmasa, to‘liq qaytariladi.',
        },
        {
          title: 'Tomonlar majburiyatlari',
          text:
            'Ijaraga beruvchi muhandislik tizimlarining ishlashini va umumiy maydonlarga ' +
            'xizmat ko‘rsatishni ta’minlaydi. Ijarachi maydondan maqsadli foydalanadi, ' +
            'yong‘in va sanitariya talablariga rioya qiladi.',
        },
        {
          title: 'Amal qilish muddati',
          text:
            `Shartnoma ${formatDmy(startsAt)} dan ${formatDmy(endsAt)} gacha amal qiladi. ` +
            'Muddat tugashidan 30 kun oldin tomonlar uzaytirish yuzasidan qaror qabul qiladi.',
        },
        {
          title: 'Imzolash tartibi',
          text:
            'Shartnoma Didox platformasi orqali imzolanadi. Imzolangan nusxa tizimga ' +
            'yuklanadi va uning SHA-256 nazorat yig‘indisi hujjat butunligini tasdiqlaydi.',
        },
      ],
      schedule: input.schedule.map((row) => ({
        label: row.label,
        dueAt: formatDmy(row.dueAt),
        total: row.total,
      })),
    }

    return { body, startsAt, endsAt, amount: totals.total }
  }

  /** Qoralamaning matnli ko‘rinishi, hujjat fayliga yoziladi. */
  render(body: ContractBody): string {
    const lines: string[] = [
      `IJARA SHARTNOMASI № ${body.code}`,
      `Toshkent shahri, ${body.composedAt}`,
      '',
      '1. TOMONLAR',
    ]

    for (const party of [body.landlord, body.tenant]) {
      lines.push(`${party.role}: ${party.name}`)
      lines.push(`STIR: ${party.tin}. Vakil: ${party.director}`)
      lines.push(`Telefon: ${party.phone}. E-pochta: ${party.email}`)
      lines.push(`Manzil: ${party.address}`)
      lines.push('')
    }

    lines.push('2. IJARA OBYEKTI')
    for (const row of body.object) lines.push(`${row.label}: ${row.value}`)
    lines.push('')

    lines.push('3. MOLIYAVIY SHARTLAR')
    for (const row of body.terms) lines.push(`${row.label}: ${row.value}`)
    lines.push('')

    lines.push('4. TO‘LOV GRAFIGI')
    for (const row of body.schedule) {
      lines.push(`${row.dueAt}, ${row.label}: ${formatMoney(row.total)}`)
    }
    lines.push('')

    lines.push('5. SHARTNOMA BANDLARI')
    body.clauses.forEach((clause, index) => {
      lines.push(`5.${index + 1}. ${clause.title}`)
      lines.push(clause.text)
    })
    lines.push('')

    lines.push('6. TOMONLARNING REKVIZITLARI VA IMZOLARI')
    lines.push(`${body.landlord.role}: ${body.landlord.name}`)
    lines.push(`${body.landlord.director} _______________________`)
    lines.push(`${body.tenant.role}: ${body.tenant.name}`)
    lines.push(`${body.tenant.director} _______________________`)

    return lines.join('\n')
  }
}

/** Depozit satrini ajratib olish, birinchi hisob-faktura uchun kerak. */
export function firstRentRow(rows: SchedulePlanRow[]): SchedulePlanRow | undefined {
  return rows.find((row) => row.kind === ScheduleKind.RENT)
}
