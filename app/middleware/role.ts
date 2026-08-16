import { ROLE_META } from '~/constants/roles'
import { ROLES, type Role } from '~/types/rbac'

/**
 * Sahifadagi `definePageMeta({ roles: [...] })` ro‘yxatini tekshiradi.
 * Ro‘yxat berilmagan sahifa barcha kirgan foydalanuvchilarga ochiq.
 * Super rahbar barcha tekshiruvlardan o‘tadi.
 */
export default defineNuxtRouteMiddleware((to) => {
  const declared = to.meta.roles
  if (!Array.isArray(declared) || declared.length === 0) return

  const auth = useAuthStore()
  if (!auth.isAuthenticated || !auth.role) {
    return navigateTo({ path: '/login', query: { next: to.fullPath } })
  }

  const role = auth.role
  if (role === 'SUPER_HEAD') return

  const allowed = declared.filter((r): r is Role => ROLES.includes(r as Role))
  if (allowed.includes(role)) return

  return navigateTo(ROLE_META[role].home)
})
