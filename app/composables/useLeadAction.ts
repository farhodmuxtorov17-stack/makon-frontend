/**
 * Bo'sh maydon uchun qaysi harakat ko'rsatilishini hal qiladi.
 *
 * Ariza yuborish bu POTENSIAL IJARACHI harakati. Ijaraga beruvchi tomonidagi
 * xodim o'z obyektiga o'zi ariza yubormaydi, shuning uchun unga bu tugma
 * ko'rinmasligi kerak. Ilgari tugma faqat «maydon bo'sh» sharti bilan
 * chiqarilardi va rahbar ham, bino rahbari ham o'z unitiga ariza yuborish
 * taklifini ko'rardi.
 *
 * Operator esa qo'ng'iroq qilgan mijoz nomidan ariza ochadi, shuning uchun
 * unga boshqa harakat beriladi: arizalar moduliga o'tish.
 */
export type LeadAction = 'apply' | 'createForClient' | 'none'

export function useLeadAction() {
  const auth = useAuthStore()
  const { t } = useI18n()

  /** Xodim: ijaraga beruvchi tomonida ishlaydigan rol */
  const isStaff = computed(
    () => auth.isAuthenticated && auth.role !== null && auth.role !== 'TENANT_OWNER',
  )

  const action = computed<LeadAction>(() => {
    if (!isStaff.value) return 'apply'
    // Arizani mijoz nomidan Operator ochadi
    return auth.can('application.decide') ? 'createForClient' : 'none'
  })

  const label = computed(() =>
    action.value === 'createForClient' ? t('obj.createForClient') : t('apply.cta'),
  )

  /** Xodimga tugma o'rniga ko'rsatiladigan izoh */
  const staffHint = computed(() => (action.value === 'none' ? t('obj.leadStaffHint') : ''))

  return { action, label, isStaff, staffHint }
}
