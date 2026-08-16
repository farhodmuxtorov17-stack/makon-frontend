import { ApiPropertyOptional } from '@nestjs/swagger'
import { BuildingStatus } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export class BuildingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BuildingStatus })
  @IsOptional()
  @IsIn(Object.values(BuildingStatus))
  status?: BuildingStatus

  @ApiPropertyOptional({ description: 'Bino turi, ma’lumotnoma qiymati' })
  @IsOptional()
  @IsString()
  type?: string

  @ApiPropertyOptional({ description: 'Shahar' })
  @IsOptional()
  @IsString()
  city?: string

  @ApiPropertyOptional({ description: 'Tuman' })
  @IsOptional()
  @IsString()
  district?: string
}

/** Bino texnik ma’lumotlarini tahrirlash. */
export class UpdateBuildingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string
  @ApiPropertyOptional() @IsOptional() @IsString() district?: string
  @ApiPropertyOptional() @IsOptional() @IsString() street?: string
  @ApiPropertyOptional() @IsOptional() @IsString() buildingClass?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sla?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lon?: number

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[]

  @ApiPropertyOptional({ description: 'Bino rahbari' })
  @IsOptional()
  @IsString()
  managerId?: string
}
