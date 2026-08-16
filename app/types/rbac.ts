/**
 * Rollar «Rollar (Makon)» hujjatining 3-bo‘limiga (funksional spetsifikatsiya)
 * to‘liq mos keladi: tartib boshqaruv darajasi bo‘yicha.
 */
export const ROLES = [
  'SUPER_HEAD',
  'BUILDING_MANAGER',
  'ACCOUNTANT',
  'FACILITY',
  'WAREHOUSE_OPERATOR',
  'CONTENT_OPERATOR',
  'TENANT_OWNER',
] as const

export type Role = (typeof ROLES)[number]

/** Kirish darajasi: to‘liq / cheklangan (biriktirilgan obyekt doirasida) / yo‘q */
export type AccessLevel = 'full' | 'scoped' | 'none'

/**
 * Amal huquqlari. Marshrutga kirish huquqi yozuv huquqini bildirmaydi:
 * masalan Super rahbar arizani ko‘radi, lekin qaror qabul qilmaydi.
 */
export const CAPABILITIES = [
  'application.decide',
  'contract.sign',
  'payment.confirm',
  'invoice.create',
  'workorder.assign',
  'workorder.execute',
  'unit.editTechnical',
  'unit.editContent',
  'warehouse.issue',
  'system.administer',
] as const

export type Capability = (typeof CAPABILITIES)[number]

export interface RoleMeta {
  code: Role
  /** Sidebar va profilda ko‘rinadigan nom */
  label: string
  /** Rolning qisqacha vazifasi */
  caption: string
  /** Boshqaruv darajasi: hujjatdagi «Tizimdagi darajasi» ustuni */
  level: string
  /** Ma’lumot ko‘rish sohasi, hujjatdagi «Scope» ustuni */
  scope: string
  /** Hujjatdagi «Cheklov» ustuni, interfeysda ochiq ko‘rsatiladi */
  limitation: string
  /** Rol nishonchasi uchun rang kaliti */
  tone: 'brand' | 'teal' | 'amber' | 'violet' | 'slate' | 'indigo' | 'rose' | 'lime'
  /** Kirgandan keyin ochiladigan sahifa */
  home: string
}

export interface SessionUser {
  id: string
  fullName: string
  role: Role
  organization: string
  /** Faqat shu binolar doirasida ma’lumot ko‘radi; bo‘sh bo‘lsa, cheklovsiz */
  buildingScope: string[]
  /** Omborchi uchun biriktirilgan ombor(lar) */
  warehouseScope?: string[]
  position: string
  phone: string
  email: string
  /** Tashkilotning soliq to‘lovchi identifikatsiya raqami */
  tin?: string
  /** Tashkilotning yuridik manzili */
  address?: string
}
