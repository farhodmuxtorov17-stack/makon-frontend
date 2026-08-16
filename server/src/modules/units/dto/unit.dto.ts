import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ListingStatus, UnitStatus } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export class UnitQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Bino identifikatori' })
  @IsOptional()
  @IsString()
  buildingId?: string

  @ApiPropertyOptional({ description: 'Qavat raqami' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number

  @ApiPropertyOptional({ enum: UnitStatus })
  @IsOptional()
  @IsIn(Object.values(UnitStatus))
  status?: UnitStatus

  @ApiPropertyOptional({ description: 'Foydalanish turi, ma’lumotnoma qiymati' })
  @IsOptional()
  @IsString()
  usage?: string

  @ApiPropertyOptional({ description: 'Taklif turi: Ijara, Sotuv, Ikkalasi' })
  @IsOptional()
  @IsString()
  offer?: string

  @ApiPropertyOptional({ description: 'Eng kichik maydon, m²' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  areaFrom?: number

  @ApiPropertyOptional({ description: 'Eng katta maydon, m²' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  areaTo?: number

  @ApiPropertyOptional({ description: 'Eng yuqori narx' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceTo?: number
}

/** Texnik atributlar: bino rahbari tahrirlaydi. */
export class UpdateUnitTechnicalDto {
  @ApiPropertyOptional({ enum: UnitStatus })
  @IsOptional()
  @IsIn(Object.values(UnitStatus))
  status?: UnitStatus

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[]
}

/** Kontent atributlari: kontent operatori tahrirlaydi. */
export class UpdateUnitContentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() usage?: string
  @ApiPropertyOptional() @IsOptional() @IsString() offer?: string
  @ApiPropertyOptional() @IsOptional() @IsString() priceUnit?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rooms?: number

  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsIn(Object.values(ListingStatus))
  listing?: ListingStatus
}

export class PolygonPointDto {
  @ApiProperty({ description: 'X koordinatasi, 0 dan 1 gacha' })
  @Type(() => Number)
  @IsNumber()
  x!: number

  @ApiProperty({ description: 'Y koordinatasi, 0 dan 1 gacha' })
  @Type(() => Number)
  @IsNumber()
  y!: number
}

export class SavePolygonDto {
  @ApiProperty({ type: [PolygonPointDto], description: 'Qavat rejasidagi ko‘pburchak nuqtalari' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolygonPointDto)
  points!: PolygonPointDto[]
}
