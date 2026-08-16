import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MeterStatus } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export const METER_TYPES = ['Elektr', 'Suv', 'Gaz', 'Issiqlik']

export class MeterQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Bino bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  buildingId?: string

  @ApiPropertyOptional({ enum: METER_TYPES })
  @IsOptional()
  @IsIn(METER_TYPES)
  type?: string

  @ApiPropertyOptional({ enum: MeterStatus })
  @IsOptional()
  @IsIn(Object.values(MeterStatus))
  status?: MeterStatus
}

export class CreateMeterReadingDto {
  @ApiProperty({ description: 'Hisoblagich ko‘rsatkichi' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number

  @ApiProperty({ description: 'O‘qilgan sana', example: '2026-08-16' })
  @IsDateString()
  readAt!: string

  @ApiPropertyOptional({ description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string
}
