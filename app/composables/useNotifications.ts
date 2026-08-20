/**
 * Bildirishnomalar bitta umumiy ro‘yxatdan o‘qiladi.
 *
 * Header qo‘ng‘irog‘i va bildirishnomalar sahifasi aynan shu yozuvlarni
 * ko‘rsatadi: birida o‘qilgan deb belgilangan xabar ikkinchisida ham darhol
 * o‘qilgan bo‘ladi va holat sahifalar orasida saqlanib qoladi.
 */
import { NOTIFICATIONS, type AppNotification } from '~/data/operations'

/**
 * Kategoriya qaysi modulga tegishli. Modulga kirish huquqi bo'lmagan rol
 * o'sha kategoriyadagi xabarni ko'rmaydi: ilgari sahifa hamma xabarni
 * ochiq ko'rsatar va omborchi begona ijarachining hisob-faktura raqamini
 * o'qiy olardi. Qo'ng'iroq menyusida bu filtr bor edi, sahifada yo'q edi,
 * shuning uchun qoida shu yerga, yagona manbaga ko'chirildi.
 */
const CATEGORY_MODULE: Partial<Record<AppNotification['category'], string>> = {
  'To‘lovlar': '/billing',
  Hujjatlar: '/contracts',
}

export function useNotifications() {
  const auth = useAuthStore()

  const all = useState<AppNotification[]>('header-notifications', () =>
    NOTIFICATIONS.map((n) => ({ ...n })),
  )

  const items = computed(() =>
    all.value.filter((n) => {
      const module = CATEGORY_MODULE[n.category]
      return module ? auth.canRoute(module) : true
    }),
  )

  const unread = computed(() => items.value.filter((n) => !n.read).length)

  function markRead(id: string) {
    const item = all.value.find((n) => n.id === id)
    if (item) item.read = true
  }

  /** Faqat ko'rinadigan xabarlar belgilanadi, yashiringani tegilmaydi */
  function markAllRead() {
    const visible = new Set(items.value.map((n) => n.id))
    all.value.forEach((n) => {
      if (visible.has(n.id)) n.read = true
    })
  }

  return { items, unread, markRead, markAllRead }
}
