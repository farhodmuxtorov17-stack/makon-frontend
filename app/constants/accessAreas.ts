import type { AccessLevel, Capability, Role } from '~/types/rbac'
import { ROLE_CAPABILITIES } from '~/constants/roles'
import { canAccess } from '~/constants/navigation'

/**
 * Ruxsat matritsasining bo‘limlari. Sozlamalar ekrani ham, huquqni tekshirish
 * ham shu ro‘yxatdan o‘qiydi: ekranda ko‘rinadigan katak va amalda ishlaydigan
 * chegara bitta manbadan keladi.
 */
export type AreaKey =
  | 'dashboard'
  | 'objects'
  | 'content'
  | 'applications'
  | 'contracts'
  | 'billing'
  | 'service'
  | 'warehouse'
  | 'meters'
  | 'reports'
  | 'settings'
  | 'cabinet'

export interface AreaDef {
  key: AreaKey
  label: string
  /** Bo‘limga tegishli marshrutlar, kirish huquqi shular bo‘yicha aniqlanadi */
  prefixes: string[]
  /** Shu bo‘limda yozuv (qaror) huquqini beruvchi amallar */
  writes: Capability[]
}

export const ACCESS_AREAS: AreaDef[] = [
  {
    key: 'dashboard',
    label: 'Boshqaruv paneli',
    prefixes: ['/dashboard/executive', '/dashboard/building'],
    writes: [],
  },
  {
    key: 'objects',
    label: 'Obyektlar va unitlar',
    prefixes: ['/objects'],
    writes: ['unit.editTechnical', 'unit.editContent'],
  },
  {
    key: 'content',
    label: 'Operator ishi',
    prefixes: ['/content'],
    writes: ['unit.editContent'],
  },
  {
    key: 'applications',
    label: 'Arizalar',
    prefixes: ['/applications'],
    writes: ['application.decide'],
  },
  {
    key: 'contracts',
    label: 'Shartnomalar',
    prefixes: ['/contracts'],
    writes: ['contract.manage'],
  },
  {
    key: 'billing',
    label: 'Billing va to‘lovlar',
    prefixes: ['/billing'],
    writes: ['payment.confirm', 'invoice.create'],
  },
  {
    key: 'service',
    label: 'Servis va ish topshiriqlari',
    prefixes: ['/service-requests', '/facility'],
    writes: ['workorder.assign', 'workorder.execute'],
  },
  {
    key: 'warehouse',
    label: 'Ombor va material',
    prefixes: ['/warehouse', '/facility/materials'],
    writes: ['warehouse.issue'],
  },
  {
    key: 'meters',
    label: 'Hisoblagichlar',
    prefixes: ['/meters'],
    writes: ['unit.editTechnical'],
  },
  {
    key: 'reports',
    label: 'Hisobotlar',
    prefixes: ['/reports'],
    writes: [],
  },
  {
    key: 'settings',
    label: 'Sozlamalar va audit',
    prefixes: ['/settings', '/settings/audit'],
    writes: ['system.administer'],
  },
  {
    // Ijarachi kabinetda hujjatlarini ko'radi va ariza yuboradi, tizimda
    // hech nimani tasdiqlamaydi: imzo Didoxda qo'yiladi.
    key: 'cabinet',
    label: 'Ijarachi kabineti',
    prefixes: ['/cabinet'],
    writes: [],
  },
]

export type { AccessLevel }

/** Bitta katak kaliti: rol va bo‘lim juftligi */
export function overrideKey(role: Role, area: AreaKey) {
  return `${role}:${area}`
}

/**
 * Boshlang‘ich daraja haqiqiy qoidalardan olinadi: marshrut yopiq → «Yo‘q»;
 * ochiq va yozuv huquqi bor → «To‘liq»; ochiq, huquq yo‘q → «Cheklangan».
 */
export function baseLevel(role: Role, area: AreaDef): AccessLevel {
  const reachable = area.prefixes.some((prefix) => canAccess(prefix, role))
  if (!reachable) return 'none'
  const caps = ROLE_CAPABILITIES[role]
  return area.writes.some((c) => caps.includes(c)) ? 'full' : 'scoped'
}

/** Berilgan yo‘l qaysi bo‘limga tegishli: eng uzun mos prefiks yutadi */
export function areaOfPath(path: string): AreaDef | undefined {
  let found: AreaDef | undefined
  let length = -1
  for (const area of ACCESS_AREAS) {
    for (const prefix of area.prefixes) {
      if (path.startsWith(prefix) && prefix.length > length) {
        found = area
        length = prefix.length
      }
    }
  }
  return found
}
