import { defineStore } from 'pinia'
import { ROLE_CAPABILITIES, ROLE_META } from '~/constants/roles'
import { ACCESS_AREAS, areaOfPath, overrideKey, type AccessLevel } from '~/constants/accessAreas'
import { canAccess } from '~/constants/navigation'
import { warehouseByName } from '~/constants/warehouses'
import type { Capability, Role, SessionUser } from '~/types/rbac'

/** Rol bo‘yicha xodim hisoblari, login orqali aniqlanadi. */
const ACCOUNTS: Record<Role, SessionUser> = {
  SUPER_HEAD: {
    id: 'u-001',
    fullName: 'Azizbek Karimov',
    role: 'SUPER_HEAD',
    organization: 'Makon Property Group',
    buildingScope: [],
    position: 'Bosh direktor',
    phone: '+998 90 123 45 67',
    email: 'a.karimov@makon.uz',
    tin: '305 412 876',
    address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
  },
  BUILDING_MANAGER: {
    id: 'u-002',
    fullName: 'Sardor Yo‘ldoshev',
    role: 'BUILDING_MANAGER',
    organization: 'Makon Property Group',
    buildingScope: ['b-01'],
    position: 'Green Business Center rahbari',
    phone: '+998 90 234 56 78',
    email: 's.yuldoshev@makon.uz',
    tin: '305 412 876',
    address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
  },
  ACCOUNTANT: {
    id: 'u-003',
    fullName: 'Nilufar Rahimova',
    role: 'ACCOUNTANT',
    organization: 'Makon Property Group',
    buildingScope: [],
    position: 'Bosh buxgalter',
    phone: '+998 90 345 67 89',
    email: 'n.rahimova@makon.uz',
    tin: '305 412 876',
    address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
  },
  FACILITY: {
    id: 'u-004',
    fullName: 'Jasur Toshmatov',
    role: 'FACILITY',
    organization: 'Servis Pro MCHJ',
    buildingScope: ['b-01', 'b-02'],
    position: 'Xo‘jalik bo‘limi ustasi',
    phone: '+998 90 456 78 90',
    email: 'j.toshmatov@servispro.uz',
    tin: '308 774 512',
    address: 'Toshkent shahri, Chilonzor tumani, Bunyodkor shoh ko‘chasi 3',
  },
  WAREHOUSE_OPERATOR: {
    id: 'u-006',
    fullName: 'Anvar Qodirov',
    role: 'WAREHOUSE_OPERATOR',
    organization: 'Makon Property Group',
    buildingScope: [],
    warehouseScope: ['w-01'],
    position: 'Markaziy ombor mudiri',
    phone: '+998 90 678 90 12',
    email: 'a.qodirov@makon.uz',
    tin: '305 412 876',
    address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
  },
  CONTENT_OPERATOR: {
    id: 'u-007',
    fullName: 'Malika Yusupova',
    role: 'CONTENT_OPERATOR',
    organization: 'Makon Property Group',
    buildingScope: ['b-01', 'b-02', 'b-05'],
    position: 'Operator',
    phone: '+998 90 789 01 23',
    email: 'm.yusupova@makon.uz',
    tin: '305 412 876',
    address: 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
  },
  TENANT_OWNER: {
    id: 'u-005',
    fullName: 'Dilshod Ergashev',
    role: 'TENANT_OWNER',
    organization: 'Urban Office MCHJ',
    buildingScope: [],
    position: 'Direktor',
    phone: '+998 90 567 89 01',
    email: 'd.ergashev@urbanoffice.uz',
    tin: '307 219 645',
    address: 'Toshkent shahri, Yunusobod tumani, Abdulla Qodiriy ko‘chasi 10',
  },
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as SessionUser | null,
    /**
     * Administrator boshqa rol ko‘rinishida tekshirishi mumkin. `realRole`
     * haqiqiy autentifikatsiya natijasi, `user.role` esa hozir ko‘rilayotgan rol.
     */
    realRole: null as Role | null,
    /**
     * Sozlamalardagi ruxsat matritsasi o‘zgartirilsa, farq shu yerda saqlanadi
     * va marshrut hamda amal tekshiruvida qo‘llanadi. Kalit: «ROL:bo‘lim».
     */
    accessOverrides: {} as Record<string, AccessLevel>,
  }),

  getters: {
    isAuthenticated: (s) => s.user !== null,
    role: (s) => s.user?.role ?? null,
    roleMeta: (s) => (s.user ? ROLE_META[s.user.role] : null),
    /** Rahbar boshqa rol ko‘rinishida tekshirmoqda */
    isViewingAs: (s) => s.realRole !== null && s.user !== null && s.realRole !== s.user.role,
    scope: (s) => s.user?.buildingScope ?? [],
    warehouseScope: (s) => s.user?.warehouseScope ?? [],

    /**
     * Amal huquqi. Marshrutga kirish huquqidan alohida: rol sahifani
     * ko‘rishi mumkin-u, undagi qarorni qabul qila olmasligi mumkin.
     */
    can: (s) => (capability: Capability) => {
      if (!s.user) return false
      const role = s.user.role
      /*
       * Bitta amal bir nechta bo‘limda uchraydi (masalan `contract.manage`
       * shartnomalarda ham, kabinetda ham). Matritsada shulardan biri
       * o‘zgartirilgan bo‘lsa, o‘sha o‘zgartirishlar hal qiladi: kamida
       * bittasi «To‘liq» bo‘lsa huquq beriladi.
       */
      const levels = ACCESS_AREAS.filter((a) => a.writes.includes(capability))
        .map((a) => s.accessOverrides[overrideKey(role, a.key)])
        .filter(Boolean)
      if (levels.length) return levels.includes('full')
      return ROLE_CAPABILITIES[role].includes(capability)
    },

    /**
     * Marshrutga kirish huquqi. Asosiy qoida `ROUTE_ACCESS` da, sozlamalarda
     * yopilgan bo‘lim esa shu yerda hisobga olinadi. Super rahbarning
     * sozlamalar bo‘limi bundan mustasno: aks holda tizim boshqaruvsiz qoladi.
     */
    canRoute: (s) => (path: string) => {
      if (!s.user) return false
      const role = s.user.role
      const area = areaOfPath(path)
      if (area && !(role === 'SUPER_HEAD' && area.key === 'settings')) {
        const level = s.accessOverrides[overrideKey(role, area.key)]
        if (level) return level !== 'none'
      }
      return canAccess(path, role)
    },

    /** Bino shu foydalanuvchining ko‘rish sohasiga kiradimi */
    inScope: (s) => (buildingId: string) => {
      const list = s.user?.buildingScope ?? []
      return list.length === 0 || list.includes(buildingId)
    },

    /** Ombor shu foydalanuvchiga biriktirilganmi */
    inWarehouseScope: (s) => (name: string) => {
      const list = s.user?.warehouseScope ?? []
      if (list.length === 0) return true
      return list.includes(warehouseByName(name)?.id ?? '')
    },
  },

  actions: {
    signIn(role: Role) {
      this.user = { ...ACCOUNTS[role] }
      this.realRole = role
    },

    /** Administrator va super rahbar boshqa rol ko‘rinishiga o‘tadi */
    viewAs(role: Role) {
      if (this.realRole !== 'SUPER_HEAD') return
      this.user = { ...ACCOUNTS[role] }
    },

    /** O‘z roliga qaytadi */
    exitViewAs() {
      if (!this.realRole) return
      this.user = { ...ACCOUNTS[this.realRole] }
    },

    /** Sozlamalardagi matritsa saqlanganda chaqiriladi */
    applyAccessOverrides(next: Record<string, AccessLevel>) {
      this.accessOverrides = { ...next }
    },

    signOut() {
      this.user = null
      this.realRole = null
    },
  },

  persist: true,
})
