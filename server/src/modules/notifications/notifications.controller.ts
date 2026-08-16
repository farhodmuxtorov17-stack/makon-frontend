import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { NotificationsService } from './notifications.service'
import { CurrentUser } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { NotificationQueryDto } from './dto/notification.dto'

@ApiTags('Bildirishnomalar')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Foydalanuvchining bildirishnomalari' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationQueryDto) {
    return this.notifications.list(user, query)
  }

  @Get('categories')
  @ApiOperation({ summary: 'Kategoriya bo‘yicha hisoblagichlar' })
  categories(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.categories(user)
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bildirishnomani o‘qilgan deb belgilash' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id)
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Barchasini o‘qilgan deb belgilash' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user)
  }
}
