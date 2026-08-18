import { ROLE_META } from '~/constants/roles'
import { STATUS_REGISTRY, type StatusKind } from '~/constants/statuses'
import type { Role } from '~/types/rbac'

/**
 * Registrlardagi (rol, status, navigatsiya) nomlarni tanlangan tilda beradi.
 * Kalit topilmasa registrdagi o‘zbekcha nom qaytadi, shuning uchun hali
 * tarjima qilinmagan ekranlar ham to‘g‘ri ishlaydi.
 */
export function useAppLabels() {
  const { t, te } = useI18n()

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

  return { t, tr, roleLabel, roleCaption, statusLabel }
}
