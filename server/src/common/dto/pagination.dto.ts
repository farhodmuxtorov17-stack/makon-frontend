import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

/** Ro‘yxat so‘rovlari uchun umumiy sahifalash parametrlari. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Sahifa raqami, birdan boshlanadi', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @ApiPropertyOptional({ description: 'Bir sahifadagi yozuvlar soni', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 20

  @ApiPropertyOptional({ description: 'Matn bo‘yicha qidiruv' })
  @IsOptional()
  @IsString()
  search?: string

  get skip(): number {
    return (this.page - 1) * this.limit
  }
}

/** Sahifalangan javob qobig‘i. */
export class PageMetaDto {
  @ApiProperty() page!: number
  @ApiProperty() limit!: number
  @ApiProperty() total!: number
  @ApiProperty() pages!: number
}

export function pageResult<T>(items: T[], total: number, query: PaginationQueryDto) {
  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    },
  }
}
