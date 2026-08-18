import { canAccess } from '~/constants/navigation'
import { ROLE_META } from '~/constants/roles'

/**
 * Autentifikatsiyasiz ochiladigan sahifalar. `/ariza` ochiq ariza formasi:
 * potensial mijoz hisob ochmasdan ariza yuboradi va uni kod bo‘yicha kuzatadi.
 */
const PUBLIC_EXACT = ['/', '/login', '/register', '/auth']
const PUBLIC_PREFIXES = ['/auth/', '/catalog', '/ariza']

/** Kirgan foydalanuvchi uchun ma’nosiz sahifalar. */
const GUEST_ONLY = ['/login', '/register']

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

  // Ruxsat berilmagan: taqiqlangan: noma’lum holatda ham kirish yopiladi.
  // `path !== home` sharti yo‘naltirish halqasining oldini oladi.
  if (!isPublic && path !== home && !canAccess(path, auth.role)) {
    return navigateTo(home)
  }
})
