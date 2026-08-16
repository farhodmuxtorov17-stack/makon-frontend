import type { Role } from '~/types/rbac'

export interface NavItem {
  label: string
  to: string
  icon: string
  /** O‘qilmagan yozuvlar soni */
  badge?: number
  children?: Array<{ label: string; to: string }>
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

const SETTINGS_CHILDREN = [
  { label: 'Foydalanuvchilar', to: '/settings/users' },
  { label: 'Rollar va huquqlar', to: '/settings/roles' },
  { label: 'Ma’lumotnomalar', to: '/settings/reference-data' },
  { label: 'Tizim sozlamalari', to: '/settings/system' },
  { label: 'Audit jurnali', to: '/settings/audit' },
]

/**
 * Bildirishnoma va profil sidebar’da emas, faqat header’da bo‘ladi, * yon menyu ish modullariga ajratilgan.
 */
const HELP_ITEM = { label: 'Yordam markazi', to: '/help', icon: 'help' }

export const NAVIGATION: Record<Role, NavSection[]> = {
  SUPER_HEAD: [
    {
      items: [
        { label: 'Boshqaruv paneli', to: '/dashboard/executive', icon: 'dashboard' },
        { label: 'Obyektlar', to: '/objects', icon: 'building' },
        { label: 'Shartnomalar', to: '/contracts', icon: 'contract' },
        { label: 'Billing va nazorat', to: '/billing/invoices', icon: 'wallet' },
        { label: 'Servis va monitoring', to: '/service-requests', icon: 'wrench' },
        { label: 'Hisobotlar', to: '/reports', icon: 'chart' },
        { label: 'Sozlamalar', to: '/settings/users', icon: 'gear', children: SETTINGS_CHILDREN },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  BUILDING_MANAGER: [
    {
      items: [
        { label: 'Boshqaruv paneli', to: '/dashboard/building', icon: 'dashboard' },
        { label: 'Obyektlar', to: '/objects', icon: 'building' },
        { label: 'Arizalar', to: '/applications', icon: 'clipboard', badge: 5 },
        { label: 'Shartnomalar', to: '/contracts', icon: 'contract' },
        { label: 'Servis arizalari', to: '/service-requests', icon: 'wrench', badge: 4 },
        { label: 'Ish topshiriqlari', to: '/facility/work-orders', icon: 'tools' },
        { label: 'Hisoblagichlar', to: '/meters', icon: 'meter' },
        { label: 'Hisobotlar', to: '/reports', icon: 'chart' },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  ACCOUNTANT: [
    {
      items: [
        { label: 'Hisob-fakturalar', to: '/billing/invoices', icon: 'wallet' },
        { label: 'To‘lovlarni tasdiqlash', to: '/billing/payments', icon: 'check', badge: 7 },
        { label: 'Qarzdorlik tahlili', to: '/billing/debts', icon: 'chart' },
        { label: 'Hisob-kitob davrlari', to: '/billing/periods', icon: 'calendar' },
        { label: 'Shartnomalar', to: '/contracts', icon: 'contract' },
        { label: 'Arizalar', to: '/applications', icon: 'clipboard', badge: 5 },
        { label: 'Hisobotlar', to: '/reports', icon: 'chart' },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  FACILITY: [
    {
      items: [
        { label: 'Mening ishlarim', to: '/facility/work-orders', icon: 'tools' },
        { label: 'Servis arizalari', to: '/service-requests', icon: 'wrench', badge: 3 },
        { label: 'Material so‘rovlari', to: '/facility/materials', icon: 'box' },
        { label: 'Hisoblagichlar', to: '/meters', icon: 'meter' },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  WAREHOUSE_OPERATOR: [
    {
      items: [
        { label: 'Ombor qoldig‘i', to: '/warehouse', icon: 'box' },
        { label: 'Material so‘rovlari', to: '/facility/materials', icon: 'clipboard', badge: 4 },
        { label: 'Kirim va chiqim', to: '/warehouse/movements', icon: 'layers' },
        { label: 'Inventarizatsiya', to: '/warehouse/inventory', icon: 'check' },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  CONTENT_OPERATOR: [
    {
      items: [
        { label: 'Kontent navbati', to: '/content', icon: 'dashboard', badge: 6 },
        { label: 'Obyektlar', to: '/objects', icon: 'building' },
        { label: 'Qavat rejalari', to: '/content/floors', icon: 'layers' },
        { label: 'Unit atributlari', to: '/content/units', icon: 'grid' },
      ],
    },
    { items: [HELP_ITEM] },
  ],

  TENANT_OWNER: [
    {
      items: [
        { label: 'Bosh sahifa', to: '/cabinet', icon: 'dashboard' },
        { label: 'Mening unitim', to: '/cabinet/units', icon: 'building' },
        { label: 'To‘lovlarim', to: '/cabinet/invoices', icon: 'wallet' },
        { label: 'Arizalarim', to: '/cabinet/applications', icon: 'clipboard' },
        { label: 'Hujjatlarim', to: '/cabinet/documents', icon: 'doc' },
        { label: 'Hisoblagichlar', to: '/cabinet/meters', icon: 'meter' },
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

  { prefix: '/applications', roles: ['SUPER_HEAD', 'BUILDING_MANAGER', 'ACCOUNTANT'] },
  { prefix: '/contracts', roles: ['SUPER_HEAD', 'BUILDING_MANAGER', 'ACCOUNTANT'] },
  { prefix: '/billing', roles: ['SUPER_HEAD', 'ACCOUNTANT'] },

  { prefix: '/service-requests', roles: ['SUPER_HEAD', 'BUILDING_MANAGER', 'FACILITY'] },
  { prefix: '/facility/materials', roles: ['FACILITY', 'BUILDING_MANAGER', 'WAREHOUSE_OPERATOR'] },
  { prefix: '/facility', roles: ['FACILITY', 'BUILDING_MANAGER', 'SUPER_HEAD'] },

  { prefix: '/warehouse', roles: ['WAREHOUSE_OPERATOR', 'BUILDING_MANAGER'] },
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
