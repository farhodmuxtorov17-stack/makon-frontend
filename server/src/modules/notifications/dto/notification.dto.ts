import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export const NOTIFICATION_CATEGORIES = [
  'To‘lovlar',
  'Arizalar',
  'Servis',
  'Hujjatlar',
  'Tizim',
]

export class NotificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_CATEGORIES })
  @IsOptional()
  @IsIn(NOTIFICATION_CATEGORIES)
  category?: string

  @ApiPropertyOptional({ description: 'Faqat o‘qilmaganlar' })
  @IsOptional()
  @IsIn(['true', 'false'])
  unread?: string
}
