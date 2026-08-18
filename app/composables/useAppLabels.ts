import { SETTINGS_CHILDREN } from '~/constants/navigation'
import { ROLE_META } from '~/constants/roles'
import {
  DIDOX_KEY,
  PERIODICITY_KEY,
  PRIORITY_KEY,
  STATUS_REGISTRY,
  type StatusKind,
} from '~/constants/statuses'
import { useAuthStore } from '~/stores/auth'
import type { Role } from '~/types/rbac'

/** `UiTable` ustuni: nom tarjima kalitidan yoki tayyor matndan olinadi */
export interface LabelColumnDef {
  key: string
  /** `field.*` guruhidagi qisqa nom, masalan `status` */
  field?: string
  /** To‘liq tarjima kaliti, masalan `nav.contracts` */
  labelKey?: string
  /** Lug‘atda kalit topilmasa ko‘rsatiladigan matn */
  label?: string
  align?: 'left' | 'right' | 'center'
  width?: string
  numeric?: boolean
}

export interface LabelColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  width?: string
  numeric?: boolean
}

export interface LabelOption {
  value: string
  label: string
}

/**
 * Registrlardagi (rol, status, navigatsiya) nomlarni tanlangan tilda beradi.
 * Kalit topilmasa registrdagi o‘zbekcha nom qaytadi, shuning uchun hali
 * tarjima qilinmagan ekranlar ham to‘g‘ri ishlaydi.
 *
 * Ekranlar uchun qoida: ko‘rinadigan har bir matn shu yerdagi yordamchilar
 * orqali olinsin. Ustun sarlavhasi `columns()`, status `statusLabel()`,
 * modul nomi `moduleTitle()`. Shunda bitta ustun uchun «Status / Holat /
 * Holati» kabi uch xil nom ham, rus tili tanlanganda o‘zbekcha qolib
 * ketadigan ekran ham qolmaydi: lug‘at bitta, u ham `i18n/locales/*.json`.
 */
export function useAppLabels() {
  const { t, te, locale } = useI18n()

  /** Kalit lug‘atda bo‘lsa tarjima, aks holda tayyor matn */
  function tr(key: string | undefined, fallback: string) {
    return key && te(key) ? t(key) : fallback
  }

  function roleLabel(role: Role | null | undefined) {
    if (!role) return ''
    return tr(`role.${role}.label`, ROLE_META[role].label)
  }

  function roleCaption(role: Role | null | undefined) {
    if (!role) return ''
    return tr(`role.${role}.caption`, ROLE_META[role].caption)
  }

  function statusLabel(kind: StatusKind, value: string) {
    const fallback = STATUS_REGISTRY[kind][value]?.label ?? value
    return tr(`status.${kind}.${value}`, fallback)
  }

  /**
   * Filtr va tanlov ro‘yxatlari uchun status variantlari. Ekran endi
   * `Object.entries(UNIT_STATUS).map(...)` yozmaydi, aks holda filtrdagi nom
   * nishonchadagi nomdan ajralib qoladi va til almashtirilganda filtr
   * o‘zbekcha qolib ketadi.
   */
  function statusOptions(kind: StatusKind, values?: string[]): LabelOption[] {
    const keys = values ?? Object.keys(STATUS_REGISTRY[kind])
    return keys.map((value) => ({ value, label: statusLabel(kind, value) }))
  }

  /** `field.*` lug‘atidan ustun yoki maydon sarlavhasi */
  function field(name: string, fallback = '') {
    return tr(`field.${name}`, fallback || name)
  }

  /** Ustunlar ro‘yxatini bir yo‘la tarjima qilib beradi */
  function columns(defs: LabelColumnDef[]): LabelColumn[] {
    return defs.map((d) => ({
      key: d.key,
      label: d.field ? field(d.field, d.label ?? d.key) : tr(d.labelKey, d.label ?? d.key),
      align: d.align,
      width: d.width,
      numeric: d.numeric,
    }))
  }

  /**
   * Modul nomi: yon menyudagi yozuv va sahifa sarlavhasi bitta kalitdan
   * o‘qiladi, shuning uchun ular hech qachon ajralib ketmaydi.
   */
  function moduleTitle(name: string, fallback = '') {
    return tr(`nav.${name}`, fallback || name)
  }

  /** Sahifa sarlavhasi ostidagi tavsif */
  function moduleCaption(name: string, fallback = '') {
    return tr(`caption.${name}`, fallback)
  }

  /** Breadcrumb bo‘lim nomi: «Billing» kabi tarjimasiz atamalar o‘rniga */
  function sectionLabel(name: string, fallback = '') {
    return tr(`section.${name}`, fallback || name)
  }

  /**
   * Ish topshiriqlari moduli ikki rolda ikki xil ataladi: pudratchi faqat
   * o‘ziga biriktirilganini ko‘radi («Mening ishlarim»), bino rahbari esa
   * butun ro‘yxatni («Ish topshiriqlari»). Sarlavha shu yerda rolga
   * bog‘lanadi, sahifada shart yozilmaydi.
   */
  function workOrdersTitle(role?: Role | null) {
    const actual = role ?? useAuthStore().role
    return actual === 'FACILITY' ? moduleTitle('myWorkOrders') : moduleTitle('workOrders')
  }

  function workOrdersCaption(role?: Role | null) {
    const actual = role ?? useAuthStore().role
    return actual === 'FACILITY' ? moduleCaption('myWorkOrders') : moduleCaption('workOrders')
  }

  /** Sozlamalar bo‘limining ichki menyusi: olti sahifada bitta ro‘yxat */
  function settingsNav(): Array<{ label: string; to: string }> {
    return SETTINGS_CHILDREN.map((c) => ({ label: tr(c.key, c.label), to: c.to }))
  }

  /**
   * Ma’lumotda o‘zbekcha qiymat sifatida saqlanadigan ro‘yxatlar. Qiymatning
   * o‘zi o‘zgarmaydi (filtr va solishtirish ishlashda qoladi), faqat
   * ko‘rinadigan nom tarjima qilinadi.
   */
  function priorityLabel(value: string) {
    return tr(PRIORITY_KEY[value], value)
  }

  function periodicityLabel(value: string) {
    return tr(PERIODICITY_KEY[value], value)
  }

  function didoxLabel(value: string) {
    return tr(DIDOX_KEY[value], value)
  }

  /** O‘lchov birligi: `sqm`, `pcs`, `currency`, `thousand`, `million`… */
  function unitOf(name: string, fallback = '') {
    return tr(`unitOf.${name}`, fallback)
  }

  /** «5-qavat» / «5 этаж» */
  function floorLabel(floor: number | string) {
    return t('unitOf.floorNo', { floor: String(floor) })
  }

  /** Oy nomi: sarlavha shakli («Avgust» / «Август») */
  function monthName(month: number) {
    return tr(`month.${month}`, String(month))
  }

  /** Oy nomi: sana ichidagi shakl («avgust» / «августа») */
  function monthOfName(month: number) {
    return tr(`monthOf.${month}`, String(month))
  }

  function isoParts(iso: string): [string, string, string] | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
    return m ? [m[1]!, m[2]!, m[3]!] : null
  }

  /**
   * «2025-05-18» → «18-may, 2025» yoki «18 мая 2025 г.».
   * `app/utils/format.ts` dagi `dateLong` sof funksiya, u tilni bilmaydi,
   * shuning uchun sana ko‘rinadigan joyda ekranlar shu variantni ishlatadi.
   */
  function dateLong(iso: string) {
    const p = isoParts(iso)
    if (!p) return iso
    return t('dateFormat.long', {
      day: String(Number(p[2])),
      month: monthOfName(Number(p[1])),
      year: p[0],
    })
  }

  /** «2026-08-18» → «Avgust 2026» / «Август 2026» (hisob davri yorlig‘i) */
  function monthTitle(iso: string) {
    const p = isoParts(iso)
    if (!p) return iso
    return t('dateFormat.monthTitle', { month: monthName(Number(p[1])), year: p[0] })
  }

  return {
    t,
    te,
    locale,
    tr,
    roleLabel,
    roleCaption,
    statusLabel,
    statusOptions,
    field,
    columns,
    moduleTitle,
    moduleCaption,
    sectionLabel,
    workOrdersTitle,
    workOrdersCaption,
    settingsNav,
    priorityLabel,
    periodicityLabel,
    didoxLabel,
    unitOf,
    floorLabel,
    monthName,
    monthOfName,
    dateLong,
    monthTitle,
  }
}
