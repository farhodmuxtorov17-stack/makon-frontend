import { INVOICES } from '~/data/business'
import { MATERIAL_REQUESTS } from '~/data/operations'
import { useAuthStore } from '~/stores/auth'
import { useLeaseStore, type LeaseStatus } from '~/stores/lease'
import type { Role } from '~/types/rbac'

export interface NavChild {
  label: string
  /** Tarjima kaliti: `nav.*`. Berilmasa `label` ko‘rsatiladi. */
  key?: string
  to: string
}

export interface NavItem {
  label: string
  /** Tarjima kaliti: `nav.*`. Berilmasa `label` ko‘rsatiladi. */
  key?: string
  to: string
  icon: string
  /** Navbatda turgan yozuvlar soni, chizish paytida hisoblanadi */
  badge?: number
  children?: NavChild[]
}

/**
 * Rol qaysi bosqichdagi arizalar uchun javobgar. Ariza sahifasidagi «Mening
 * vazifalarim» navbati ham shu ro‘yxatdan o‘qiladi, shuning uchun yon
 * menyudagi son sahifadagi son bilan doim mos tushadi.
 */
export const APPLICATION_QUEUE: Partial<Record<Role, LeaseStatus[]>> = {
  BUILDING_MANAGER: ['YANGI', 'QORALAMA_TAYYOR', 'DIDOX_YUBORILDI', 'DIDOX_IMZOLANDI'],
  // MOLIYA_TASDIQLADI ataylab kiritilmagan: `approveFinance` shu holatni
  // qo‘yib, o‘sha zahoti `composeContract` ni chaqiradi va ariza
  // QORALAMA_TAYYOR ga o‘tadi. Ya’ni bu bosqichda buxgalterda bosadigan
  // tugma yo‘q, uni nishonchaga qo‘shish bajarib bo‘lmaydigan vazifani
  // ko‘rsatgan bo‘lar edi. Agar kelajakda shu holatda qoladigan qaror
  // qo‘shilsa, qiymat shu yerga qaytariladi.
  ACCOUNTANT: ['OPERATSIYA_TASDIQLADI'],
}

/** Bo‘sh navbat nishonchasiz ko‘rsatiladi */
function queueBadge(count: () => number): number | undefined {
  try {
    const value = count()
    return value > 0 ? value : undefined
  } catch {
    return undefined
  }
}

/** Biriktirilgan binolardagi, shu rol qaroriga qolgan arizalar */
function applicationQueue(): number {
  const auth = useAuthStore()
  const statuses = auth.role ? (APPLICATION_QUEUE[auth.role] ?? []) : []
  if (!statuses.length) return 0
  return useLeaseStore().cases.filter(
    (c) => statuses.includes(c.status) && auth.inScope(c.buildingId),
  ).length
}

/** To‘lov kutayotgan hisob-fakturalar: to‘lov sahifasidagi navbat bilan bir xil shart */
function paymentQueue(): number {
  return INVOICES.filter((i) => i.status === 'ISSUED' || i.status === 'PARTIALLY_PAID').length
}

/**
 * Ombordan berilishi kutilayotgan material so‘rovlari. Faqat APPROVED
 * sanaladi: SUBMITTED so‘rov bino rahbarining qaroriga turadi, omborchida
 * uni siljitadigan amal yo‘q edi, shuning uchun u nishonchadan chiqarildi.
 * Shu shart ombor sahifasidagi «berish dalolatnomalari» ro‘yxatidagi ochiq
 * yozuvlar bilan bir xil, ya’ni yon menyudagi son sahifadagi son bilan
 * mos tushadi.
 */
function materialQueue(): number {
  return MATERIAL_REQUESTS.filter((r) => r.status === 'APPROVED').length
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

export const SETTINGS_CHILDREN: NavChild[] = [
  { label: 'Foydalanuvchilar', key: 'nav.settingsUsers', to: '/settings/users' },
  { label: 'Rollar va huquqlar', key: 'nav.settingsRoles', to: '/settings/roles' },
  { label: 'Integratsiyalar', key: 'nav.settingsIntegrations', to: '/settings/integrations' },
  { label: 'Ma’lumotnomalar', key: 'nav.settingsReference', to: '/settings/reference-data' },
  { label: 'Tizim sozlamalari', key: 'nav.settingsSystem', to: '/settings/system' },
  { label: 'Audit jurnali', key: 'nav.settingsAudit', to: '/settings/audit' },
]

/**
 * Bildirishnoma va profil sidebar’da emas, faqat header’da bo‘ladi,
 * yon menyu ish modullariga ajratilgan.
 */
const HELP_ITEM: NavItem = { label: 'Yordam markazi', key: 'nav.help', to: '/help', icon: 'help' }

export const NAVIGATION: Record<Role, NavSection[]> = {
  SUPER_HEAD: [
    {
      items: [
        {
          label: 'Boshqaruv paneli',
          key: 'nav.dashboardExecutive',
          to: '/dashboard/executive',
          icon: 'dashboard',
          children: [
            { label: 'Bino kesimida', key: 'nav.dashboardBuilding', to: '/dashboard/building' },
          ],
        },
        { label: 'Obyektlar', key: 'nav.objects', to: '/objects', icon: 'building' },
        {
          label: 'Arizalar',
          key: 'nav.applications',
          to: '/applications',
          icon: 'clipboard',
          get badge() {
            return queueBadge(applicationQueue)
          },
        },
        { label: 'Shartnomalar', key: 'nav.contracts', to: '/contracts', icon: 'contract' },
        { label: 'Hisob-kitob va nazorat', key: 'nav.billing', to: '/billing/invoices', icon: 'wallet' },
        {
          label: 'Servis va monitoring',
          key: 'nav.serviceMonitoring',
          to: '/service-requests',
          icon: 'wrench',
          children: [
            { label: 'Ish topshiriqlari', key: 'nav.workOrders', to: '/facility/work-orders' },
            { label: 'Hisoblagichlar', key: 'nav.meters', to: '/meters' },
          ],
        },
        { label: 'Hisobotlar', key: 'nav.reports', to: '/reports', icon: 'chart' },
        { label: 'Sozlamalar', key: 'nav.settings', to: '/settings/users', icon: 'gear', children: SETTINGS_CHILDREN },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  BUILDING_MANAGER: [
    {
      items: [
        { label: 'Boshqaruv paneli', key: 'nav.dashboardBuilding', to: '/dashboard/building', icon: 'dashboard' },
        { label: 'Obyektlar', key: 'nav.objects', to: '/objects', icon: 'building' },
        {
          label: 'Arizalar',
          key: 'nav.applications',
          to: '/applications',
          icon: 'clipboard',
          get badge() {
            return queueBadge(applicationQueue)
          },
        },
        { label: 'Shartnomalar', key: 'nav.contracts', to: '/contracts', icon: 'contract' },
        { label: 'Servis arizalari', key: 'nav.serviceRequests', to: '/service-requests', icon: 'wrench' },
        {
          label: 'Ish topshiriqlari',
          key: 'nav.workOrders',
          to: '/facility/work-orders',
          icon: 'tools',
          // Material so'rovini bino rahbari tasdiqlaydi, shuning uchun havola menyuda
          children: [
            { label: 'Material so‘rovlari', key: 'nav.materials', to: '/facility/materials' },
          ],
        },
        { label: 'Hisoblagichlar', key: 'nav.meters', to: '/meters', icon: 'meter' },
        { label: 'Hisobotlar', key: 'nav.reports', to: '/reports', icon: 'chart' },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  ACCOUNTANT: [
    {
      items: [
        { label: 'Hisob-fakturalar', key: 'nav.invoices', to: '/billing/invoices', icon: 'wallet' },
        {
          label: 'To‘lovlarni tasdiqlash',
          key: 'nav.paymentsApprove',
          to: '/billing/payments',
          icon: 'check',
          get badge() {
            return queueBadge(paymentQueue)
          },
        },
        { label: 'Qarzdorlik tahlili', key: 'nav.debts', to: '/billing/debts', icon: 'chart' },
        { label: 'Hisob-kitob davrlari', key: 'nav.periods', to: '/billing/periods', icon: 'calendar' },
        { label: 'Shartnomalar', key: 'nav.contracts', to: '/contracts', icon: 'contract' },
        {
          label: 'Arizalar',
          key: 'nav.applications',
          to: '/applications',
          icon: 'clipboard',
          get badge() {
            return queueBadge(applicationQueue)
          },
        },
        { label: 'Hisobotlar', key: 'nav.reports', to: '/reports', icon: 'chart' },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  FACILITY: [
    {
      items: [
        { label: 'Mening ishlarim', key: 'nav.myWorkOrders', to: '/facility/work-orders', icon: 'tools' },
        { label: 'Servis arizalari', key: 'nav.serviceRequests', to: '/service-requests', icon: 'wrench' },
        { label: 'Material so‘rovlari', key: 'nav.materials', to: '/facility/materials', icon: 'box' },
        { label: 'Hisoblagichlar', key: 'nav.meters', to: '/meters', icon: 'meter' },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  WAREHOUSE_OPERATOR: [
    {
      items: [
        { label: 'Ombor va jihozlar', key: 'nav.warehouse', to: '/warehouse', icon: 'box' },
        {
          label: 'Material so‘rovlari',
          key: 'nav.materials',
          to: '/facility/materials',
          icon: 'clipboard',
          get badge() {
            return queueBadge(materialQueue)
          },
        },
        { label: 'Kirim va chiqim', key: 'nav.movements', to: '/warehouse/movements', icon: 'layers' },
        { label: 'Inventarizatsiya', key: 'nav.inventory', to: '/warehouse/inventory', icon: 'check' },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  // Operator ijara jarayonini boshidan oxirigacha olib boradi, shuning uchun
  // arizalar va shartnomalar uning menyusida birinchi turadi
  CONTENT_OPERATOR: [
    {
      items: [
        {
          label: 'Arizalar',
          key: 'nav.applications',
          to: '/applications',
          icon: 'clipboard',
          get badge() {
            return queueBadge(applicationQueue)
          },
        },
        { label: 'Shartnomalar', key: 'nav.contracts', to: '/contracts', icon: 'contract' },
        { label: 'Obyektlar', key: 'nav.objects', to: '/objects', icon: 'building' },
        {
          label: 'Kontent',
          key: 'nav.contentQueue',
          to: '/content',
          icon: 'grid',
          children: [
            { label: 'Qavat rejalari', key: 'nav.floors', to: '/content/floors' },
            { label: 'Unit atributlari', key: 'nav.unitAttributes', to: '/content/units' },
          ],
        },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  TENANT_OWNER: [
    {
      items: [
        { label: 'Bosh sahifa', key: 'nav.cabinet', to: '/cabinet', icon: 'dashboard' },
        { label: 'Mening unitlarim', key: 'nav.myUnits', to: '/cabinet/units', icon: 'building' },
        { label: 'To‘lovlarim', key: 'nav.myInvoices', to: '/cabinet/invoices', icon: 'wallet' },
        { label: 'Arizalarim', key: 'nav.myApplications', to: '/cabinet/applications', icon: 'clipboard' },
        { label: 'Hujjatlarim', key: 'nav.myDocuments', to: '/cabinet/documents', icon: 'doc' },
        { label: 'Hisoblagichlar', key: 'nav.meters', to: '/cabinet/meters', icon: 'meter' },
      ],
    },
    { items: [HELP_ITEM] },
  ],
}

/**
 * Sahifa yo‘li qaysi rollarga ochiqligi. Eng uzun mos keluvchi prefiks
 * qo‘llanadi, shuning uchun aniqroq qoida umumiyroq qoidani bekor qiladi.
 */
export const ROUTE_ACCESS: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/dashboard/executive', roles: ['SUPER_HEAD'] },
  { prefix: '/dashboard/building', roles: ['SUPER_HEAD', 'BUILDING_MANAGER'] },

  { prefix: '/objects', roles: ['SUPER_HEAD', 'BUILDING_MANAGER', 'CONTENT_OPERATOR'] },
  { prefix: '/content', roles: ['CONTENT_OPERATOR'] },

  // Arizani Operator yuritadi, rahbar va buxgalter kuzatadi
  {
    prefix: '/applications',
    roles: ['SUPER_HEAD', 'CONTENT_OPERATOR', 'BUILDING_MANAGER', 'ACCOUNTANT'],
  },
  {
    prefix: '/contracts',
    roles: ['SUPER_HEAD', 'CONTENT_OPERATOR', 'BUILDING_MANAGER', 'ACCOUNTANT'],
  },
  { prefix: '/billing', roles: ['SUPER_HEAD', 'ACCOUNTANT'] },

  { prefix: '/service-requests', roles: ['SUPER_HEAD', 'BUILDING_MANAGER', 'FACILITY'] },
  { prefix: '/facility/materials', roles: ['FACILITY', 'BUILDING_MANAGER', 'WAREHOUSE_OPERATOR'] },
  { prefix: '/facility', roles: ['FACILITY', 'BUILDING_MANAGER', 'SUPER_HEAD'] },

  // Ombor omborchining moduli; bino rahbari material so‘rovi orqali ishlaydi
  { prefix: '/warehouse', roles: ['WAREHOUSE_OPERATOR'] },
  { prefix: '/meters', roles: ['SUPER_HEAD', 'BUILDING_MANAGER', 'FACILITY'] },
  { prefix: '/reports', roles: ['SUPER_HEAD', 'BUILDING_MANAGER', 'ACCOUNTANT'] },

  // Audit jurnalini rahbar ham ko‘radi, qolgan sozlamalar faqat administratorda
  { prefix: '/settings/audit', roles: ['SUPER_HEAD'] },
  { prefix: '/settings', roles: ['SUPER_HEAD'] },

  { prefix: '/cabinet', roles: ['TENANT_OWNER'] },
]

export function canAccess(path: string, role: Role): boolean {
  const rule = ROUTE_ACCESS.filter((r) => path.startsWith(r.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0]
  // Qoida yozilmagan sahifalar (bildirishnoma, yordam, profil) barcha
  // autentifikatsiyadan o‘tgan foydalanuvchilarga ochiq.
  return rule ? rule.roles.includes(role) : true
}
