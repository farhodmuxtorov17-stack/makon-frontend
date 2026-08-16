import { Role } from '@prisma/client'

/**
 * Amal huquqlari ro‘yxati `app/types/rbac.ts` bilan bir xil, jadval esa
 * `app/constants/roles.ts` dagi `ROLE_CAPABILITIES` ning aynan nusxasi.
 * Marshrutga kirish huquqi yozuv huquqini bildirmaydi: rol sahifani ko‘rishi
 * mumkin-u, undagi qarorni qabul qila olmasligi mumkin.
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

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  SUPER_HEAD: ['contract.sign', 'system.administer'],
  BUILDING_MANAGER: [
    'application.decide',
    'contract.sign',
    'workorder.assign',
    'unit.editTechnical',
  ],
  ACCOUNTANT: ['application.decide', 'contract.sign', 'payment.confirm', 'invoice.create'],
  FACILITY: ['workorder.execute'],
  WAREHOUSE_OPERATOR: ['warehouse.issue'],
  CONTENT_OPERATOR: ['unit.editContent'],
  TENANT_OWNER: ['contract.sign'],
}

/** Rolning interfeysdagi nomi, audit yozuvlarida ham shu nom ishlatiladi. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_HEAD: 'Super rahbar',
  BUILDING_MANAGER: 'Bino rahbari',
  ACCOUNTANT: 'Buxgalter',
  FACILITY: 'Pudratchi / xo‘jalik bo‘limi',
  WAREHOUSE_OPERATOR: 'Omborchi',
  CONTENT_OPERATOR: 'Kontent operatori',
  TENANT_OWNER: 'Ijarachi / mulkdor',
}

/** Kirgandan keyin ochiladigan sahifa, ruxsat bo‘lmaganda ham shu yerga qaytariladi. */
export const ROLE_HOME: Record<Role, string> = {
  SUPER_HEAD: '/dashboard/executive',
  BUILDING_MANAGER: '/dashboard/building',
  ACCOUNTANT: '/billing/invoices',
  FACILITY: '/facility/work-orders',
  WAREHOUSE_OPERATOR: '/warehouse',
  CONTENT_OPERATOR: '/content',
  TENANT_OWNER: '/cabinet',
}

export function hasCapability(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability)
}
