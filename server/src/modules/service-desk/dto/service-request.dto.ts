import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ServiceStatus } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export const SERVICE_CATEGORIES = [
  'Santexnika',
  'Elektr',
  'Konditsioner',
  'Qurilish',
  'Tozalash',
  'Boshqa',
]

export const SERVICE_PRIORITIES = ['Past', 'O‘rtacha', 'Yuqori']

export class ServiceRequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ServiceStatus })
  @IsOptional()
  @IsIn(Object.values(ServiceStatus))
  status?: ServiceStatus

  @ApiPropertyOptional({ description: 'Bino bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  buildingId?: string

  @ApiPropertyOptional({ enum: SERVICE_CATEGORIES })
  @IsOptional()
  @IsIn(SERVICE_CATEGORIES)
  category?: string

  @ApiPropertyOptional({ enum: SERVICE_PRIORITIES })
  @IsOptional()
  @IsIn(SERVICE_PRIORITIES)
  priority?: string

  @ApiPropertyOptional({ description: 'Faqat muddati buzilganlar' })
  @IsOptional()
  @IsIn(['true', 'false'])
  slaBreached?: string
}

export class CreateServiceRequestDto {
  @ApiProperty({ description: 'Ariza sarlavhasi' })
  @IsString()
  @IsNotEmpty({ message: 'Sarlavha kiritilishi kerak' })
  title!: string

  @ApiProperty({ enum: SERVICE_CATEGORIES })
  @IsIn(SERVICE_CATEGORIES, { message: 'Kategoriya noto‘g‘ri' })
  category!: string

  @ApiProperty({ description: 'Bino identifikatori' })
  @IsString()
  @IsNotEmpty()
  buildingId!: string

  @ApiPropertyOptional({ description: 'Unit identifikatori' })
  @IsOptional()
  @IsString()
  unitId?: string

  @ApiProperty({ description: 'Unit yoki umumiy zona nomi' })
  @IsString()
  @IsNotEmpty()
  unitCode!: string

  @ApiProperty({ enum: SERVICE_PRIORITIES })
  @IsIn(SERVICE_PRIORITIES, { message: 'Muhimlik darajasi noto‘g‘ri' })
  priority!: string

  @ApiProperty({ description: 'Muammo tavsifi' })
  @IsString()
  @IsNotEmpty({ message: 'Tavsif kiritilishi kerak' })
  description!: string

  @ApiPropertyOptional({ description: 'Bajarish muddati' })
  @IsOptional()
  @IsDateString()
  dueAt?: string
}

export class AssignServiceRequestDto {
  @ApiProperty({ description: 'Ijrochi identifikatori' })
  @IsString()
  @IsNotEmpty()
  assigneeId!: string

  @ApiPropertyOptional({ description: 'Bajarish muddati' })
  @IsOptional()
  @IsDateString()
  dueAt?: string
}

export class ChangeServiceStatusDto {
  @ApiProperty({ enum: ServiceStatus })
  @IsIn(Object.values(ServiceStatus))
  status!: ServiceStatus

  @ApiPropertyOptional({ description: 'Bajarilish darajasi, foiz' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number

  @ApiPropertyOptional({ description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string
}
