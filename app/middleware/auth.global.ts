import { ROLE_META } from '~/constants/roles'

/**
 * Autentifikatsiyasiz ochiladigan sahifalar. `/ariza` ochiq ariza formasi:
 * potensial mijoz hisob ochmasdan ariza yuboradi va uni kod bo‘yicha kuzatadi.
 */
const PUBLIC_EXACT = ['/', '/login']
const PUBLIC_PREFIXES = ['/catalog', '/ariza']

/** Kirgan foydalanuvchi uchun ma’nosiz sahifalar. */
const GUEST_ONLY = ['/login']

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  const path = to.path.replace(/\/+$/, '') || '/'

  const isPublic = PUBLIC_EXACT.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))

  if (!auth.isAuthenticated || !auth.role) {
    if (isPublic) return
    return navigateTo({ path: '/login', query: { next: to.fullPath } })
  }

  const home = ROLE_META[auth.role].home

  // Kirgan foydalanuvchi kirish yoki qayd oynasiga qaytmaydi.
  if (GUEST_ONLY.includes(path)) return navigateTo(home)

  /*
   * Yagona manba: `ROUTE_ACCESS` jadvali. Rol bo‘yicha istisno qoldirilmaydi,
   * yon menyu, havolalar va `canRoute()` shu jadvaldan o‘qiydi, shuning uchun
   * qo‘riqchi ham undan chetga chiqmasligi kerak. Aks holda menyuda
   * ko‘rinmaydigan bo‘lim manzil orqali ochilib qoladi.
   *
   * `path !== home` sharti yo‘naltirish halqasining oldini oladi.
   */
  if (!isPublic && path !== home && !auth.canRoute(path)) {
    return navigateTo(home)
  }
})
