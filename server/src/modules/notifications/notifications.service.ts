import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { pageResult } from '../../common/dto/pagination.dto'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { NOTIFICATION_CATEGORIES, type NotificationQueryDto } from './dto/notification.dto'

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      category: query.category,
      read: query.unread === 'true' ? false : undefined,
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ])

    return pageResult(
      items.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        category: item.category,
        icon: item.icon,
        at: item.createdAt.toISOString(),
        read: item.read,
        link: item.link,
      })),
      total,
      query,
    )
  }

  /** Header dagi hisoblagich va kategoriya ro‘yxati. */
  async categories(user: AuthenticatedUser) {
    const grouped = await this.prisma.notification.groupBy({
      by: ['category'],
      where: { userId: user.id },
      _count: { _all: true },
    })

    const total = grouped.reduce((sum, row) => sum + row._count._all, 0)
    const unread = await this.prisma.notification.count({
      where: { userId: user.id, read: false },
    })

    return {
      unread,
      items: [
        { label: 'Barchasi', count: total },
        ...NOTIFICATION_CATEGORIES.map((label) => ({
          label,
          count: grouped.find((row) => row.category === label)?._count._all ?? 0,
        })),
      ],
    }
  }

  async markRead(user: AuthenticatedUser, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    })
    if (!notification) throw new NotFoundException('Bildirishnoma topilmadi')

    await this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    })

    return { id, read: true }
  }

  async markAllRead(user: AuthenticatedUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true, readAt: new Date() },
    })
    return { updated: result.count }
  }
}
