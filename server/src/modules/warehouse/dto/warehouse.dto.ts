import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { StockMovementKind } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export const STOCK_CATEGORIES = [
  'Mebel',
  'Elektr jihozlar',
  'Sanitariya',
  'Qurilish',
  'IT jihozlar',
  'Boshqalar',
]

export class WarehouseItemQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Ombor identifikatori' })
  @IsOptional()
  @IsString()
  warehouseId?: string

  @ApiPropertyOptional({ enum: STOCK_CATEGORIES })
  @IsOptional()
  @IsIn(STOCK_CATEGORIES)
  category?: string

  @ApiPropertyOptional({ description: 'Faqat eng kam qoldiqdan pastdagilar' })
  @IsOptional()
  @IsIn(['true', 'false'])
  lowStock?: string
}

export class StockMovementQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Ombor identifikatori' })
  @IsOptional()
  @IsString()
  warehouseId?: string

  @ApiPropertyOptional({ enum: StockMovementKind })
  @IsOptional()
  @IsIn(Object.values(StockMovementKind))
  kind?: StockMovementKind
}

export class CreateStockMovementDto {
  @ApiProperty({ description: 'Ombor pozitsiyasi identifikatori' })
  @IsString()
  @IsNotEmpty()
  warehouseItemId!: string

  @ApiProperty({ enum: StockMovementKind })
  @IsIn(Object.values(StockMovementKind))
  kind!: StockMovementKind

  @ApiProperty({ description: 'Miqdor' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number

  @ApiPropertyOptional({ description: 'Elektron nakladnoy raqami' })
  @IsOptional()
  @IsString()
  waybillNumber?: string

  @ApiPropertyOptional({ description: 'Asos' })
  @IsOptional()
  @IsString()
  reason?: string
}

export class InventoryLineDto {
  @ApiProperty() @IsString() @IsNotEmpty() warehouseItemId!: string

  @ApiProperty({ description: 'Sanab chiqilgan miqdor' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedQty!: number

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}

export class CreateInventorySessionDto {
  @ApiProperty({ description: 'Ombor identifikatori' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string

  @ApiPropertyOptional({ description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string
}

export class SubmitInventoryCountDto {
  @ApiProperty({ type: [InventoryLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryLineDto)
  lines!: InventoryLineDto[]
}
