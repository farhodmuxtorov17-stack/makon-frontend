/**
 * Bo'sh maydon uchun qaysi harakat ko'rsatilishini hal qiladi.
 *
 * Ariza yuborish potensial ijarachining harakati. Ijaraga beruvchi tomonidagi
 * xodim o'z obyektiga o'zi ariza yubormaydi, shuning uchun katalog va obyekt
 * ekranlarida unga bu tugma umuman ko'rsatilmaydi. Operator ham mijoz nomidan
 * arizani shu yerdan emas, arizalar modulida ochadi: ariza bilan ishlash
 * o'sha modulning vazifasi.
 */
export type LeadAction = 'apply' | 'none'

export function useLeadAction() {
  const auth = useAuthStore()
  const { t } = useI18n()

  /** Xodim: ijaraga beruvchi tomonida ishlaydigan rol */
  const isStaff = computed(
    () => auth.isAuthenticated && auth.role !== null && auth.role !== 'TENANT_OWNER',
  )

  const action = computed<LeadAction>(() => (isStaff.value ? 'none' : 'apply'))

  const label = computed(() => t('apply.cta'))

  /** Xodimga tugma o'rniga ko'rsatiladigan izoh */
  const staffHint = computed(() => (isStaff.value ? t('obj.leadStaffHint') : ''))

  return { action, label, isStaff, staffHint }
}
