import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Yozuv turi, masalan leaseCase yoki invoice' })
  @IsOptional()
  @IsString()
  entityType?: string

  @ApiPropertyOptional({ description: 'Yozuv identifikatori' })
  @IsOptional()
  @IsString()
  entityId?: string

  @ApiPropertyOptional({ description: 'Amalni bajargan foydalanuvchi' })
  @IsOptional()
  @IsString()
  actorId?: string
}
