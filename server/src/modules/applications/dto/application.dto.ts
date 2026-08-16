import { ApiPropertyOptional } from '@nestjs/swagger'
import { ApplicationStatus, LeaseStatus } from '@prisma/client'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export class ApplicationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApplicationStatus, description: 'Ariza reyestrining holati' })
  @IsOptional()
  @IsIn(Object.values(ApplicationStatus))
  status?: ApplicationStatus

  @ApiPropertyOptional({ enum: LeaseStatus, description: 'Ijara siklidagi holat' })
  @IsOptional()
  @IsIn(Object.values(LeaseStatus))
  leaseStatus?: LeaseStatus

  @ApiPropertyOptional({ description: 'Bino bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  buildingId?: string
}
