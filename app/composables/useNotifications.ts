/**
 * Bildirishnomalar bitta umumiy ro‘yxatdan o‘qiladi.
 *
 * Header qo‘ng‘irog‘i va bildirishnomalar sahifasi aynan shu yozuvlarni
 * ko‘rsatadi: birida o‘qilgan deb belgilangan xabar ikkinchisida ham darhol
 * o‘qilgan bo‘ladi va holat sahifalar orasida saqlanib qoladi.
 */
import { NOTIFICATIONS, type AppNotification } from '~/data/operations'

export function useNotifications() {
  const items = useState<AppNotification[]>('header-notifications', () =>
    NOTIFICATIONS.map((n) => ({ ...n })),
  )

  const unread = computed(() => items.value.filter((n) => !n.read).length)

  function markRead(id: string) {
    const item = items.value.find((n) => n.id === id)
    if (item) item.read = true
  }

  function markAllRead() {
    items.value.forEach((n) => (n.read = true))
  }

  return { items, unread, markRead, markAllRead }
}
