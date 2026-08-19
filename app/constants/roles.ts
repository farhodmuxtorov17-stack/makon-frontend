import type { Capability, Role, RoleMeta } from '~/types/rbac'

export const ROLE_META: Record<Role, RoleMeta> = {
  SUPER_HEAD: {
    code: 'SUPER_HEAD',
    label: 'Super rahbar',
    caption: 'Portfel bo‘yicha strategik nazorat',
    level: 'Strategik boshqaruv',
    scope: 'Barcha obyektlar',
    limitation: 'Ariza va to‘lovni tahrirlamaydi, qaror operatsion rollarda',
    tone: 'brand',
    home: '/dashboard/executive',
  },
  BUILDING_MANAGER: {
    code: 'BUILDING_MANAGER',
    label: 'Bino rahbari',
    caption: 'Obyekt darajasidagi operatsion boshqaruv',
    level: 'Obyekt darajasidagi operatsion boshqaruv',
    scope: 'Biriktirilgan bino(lar)',
    limitation: 'Boshqa bino ma’lumotiga kira olmaydi',
    tone: 'teal',
    home: '/dashboard/building',
  },
  ACCOUNTANT: {
    code: 'ACCOUNTANT',
    label: 'Buxgalter',
    caption: 'Moliyaviy va huquqiy nazorat',
    level: 'Moliyaviy va huquqiy nazorat',
    scope: 'Biriktirilgan bino yoki tashkilot',
    limitation: 'Unit texnik holatini o‘zgartirmaydi',
    tone: 'violet',
    home: '/billing/invoices',
  },
  FACILITY: {
    code: 'FACILITY',
    label: 'Pudratchi / xo‘jalik bo‘limi',
    caption: 'Texnik xizmat va ta’mirlash ishlari',
    level: 'Ijrochi operatsion rol',
    scope: 'Biriktirilgan ish topshiriqlari',
    limitation: 'Moliyaviy tasdiq va shartnomaga kira olmaydi',
    tone: 'amber',
    home: '/facility/work-orders',
  },
  WAREHOUSE_OPERATOR: {
    code: 'WAREHOUSE_OPERATOR',
    label: 'Omborchi',
    caption: 'Material va jihozlar harakati',
    level: 'Resurs va moddiy hisob roli',
    scope: 'Biriktirilgan ombor',
    limitation: 'Moliyaviy qaror qabul qilmaydi',
    tone: 'lime',
    home: '/warehouse',
  },
  CONTENT_OPERATOR: {
    code: 'CONTENT_OPERATOR',
    label: 'Operator',
    caption: 'Arizalar, shartnomalar va obyekt ma’lumotlari',
    level: 'Ijara jarayonini olib boruvchi rol',
    scope: 'Biriktirilgan binolar',
    limitation: 'To‘lovni tasdiqlamaydi va hisob-faktura chiqarmaydi',
    tone: 'rose',
    home: '/applications',
  },
  TENANT_OWNER: {
    code: 'TENANT_OWNER',
    label: 'Ijarachi / mulkdor',
    caption: 'Shaxsiy kabinet va xizmatlar',
    level: 'Tashqi foydalanuvchi',
    scope: 'Faqat o‘z tashkiloti va unitlari',
    limitation: 'Boshqa ijarachi va ichki KPIlarni ko‘rmaydi',
    tone: 'slate',
    home: '/cabinet',
  },
}

/**
 * Amal huquqlari: marshrutga kirish huquqidan alohida. Hujjatdagi «Cheklov»
 * ustuni aynan shu jadval orqali kuchga kiradi.
 */
/*
 * Huquqlar ijara jarayonining haqiqiy egalariga berilgan.
 *
 * Arizani Operator qabul qiladi, u bilan bog'lanadi va tasdiqlaydi; tasdiq
 * bosilishi bilan shartnoma generatsiya qilinadi va Didoxga yuboriladi.
 * Shuning uchun `application.decide` va `contract.manage` Operatorda.
 *
 * Imzo tizimda emas, Didoxda qo'yiladi. `contract.manage` shartnomani
 * tayyorlash, tahrirlash, yuborish va imzolangan nusxani yuklashni bildiradi.
 * Ijarachiga tizimda hech qanday yozuv huquqi berilmaydi: u ariza yuboradi va
 * kabinetda o'z hujjatlarini ko'radi.
 */
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  SUPER_HEAD: ['application.decide', 'contract.manage', 'system.administer'],
  BUILDING_MANAGER: ['application.decide', 'workorder.assign', 'unit.editTechnical'],
  ACCOUNTANT: ['payment.confirm', 'invoice.create'],
  FACILITY: ['workorder.execute'],
  WAREHOUSE_OPERATOR: ['warehouse.issue'],
  CONTENT_OPERATOR: ['application.decide', 'contract.manage', 'unit.editContent'],
  TENANT_OWNER: [],
}

/**
 * Rol nishonchasi ranglari ataylab holat ranglaridan (yashil/sariq/qizil)
 * mustaqil: aks holda rol belgisi status belgisi bilan chalkashadi.
 */
export const ROLE_TONE_CLASSES: Record<RoleMeta['tone'], string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
  violet: 'bg-info-50 text-info-700 ring-info-100',
  amber: 'bg-warn-50 text-warn-700 ring-warn-100',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  lime: 'bg-lime-50 text-lime-700 ring-lime-200',
  slate: 'bg-ink-100 text-ink-700 ring-ink-200',
}

export const ROLE_RING_CLASSES: Record<RoleMeta['tone'], string> = {
  brand: 'ring-brand-500',
  teal: 'ring-teal-500',
  violet: 'ring-info-500',
  amber: 'ring-warn-500',
  indigo: 'ring-indigo-500',
  rose: 'ring-rose-500',
  lime: 'ring-lime-500',
  slate: 'ring-ink-400',
}
