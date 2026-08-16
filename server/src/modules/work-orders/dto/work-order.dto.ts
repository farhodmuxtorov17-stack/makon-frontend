import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MaterialStatus, WorkOrderStatus } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export class WorkOrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WorkOrderStatus })
  @IsOptional()
  @IsIn(Object.values(WorkOrderStatus))
  status?: WorkOrderStatus

  @ApiPropertyOptional({ description: 'Bino bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  buildingId?: string

  @ApiPropertyOptional({ description: 'Faqat menga biriktirilganlar' })
  @IsOptional()
  @IsIn(['true', 'false'])
  mine?: string
}

export class ChecklistItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() label!: string
  @ApiProperty() @IsBoolean() done!: boolean
}

export class UpdateWorkOrderProgressDto {
  @ApiProperty({ description: 'Bajarilish darajasi, foiz' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress!: number

  @ApiPropertyOptional({ type: [ChecklistItemDto], description: 'Ishlar ro‘yxati' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[]

  @ApiPropertyOptional({ description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string
}

export class CompleteWorkOrderDto {
  @ApiProperty({ description: 'Bajarilgan ish haqida qisqacha' })
  @IsString()
  @IsNotEmpty({ message: 'Natija bayoni kiritilishi kerak' })
  resultNote!: string
}

export class MaterialRequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MaterialStatus })
  @IsOptional()
  @IsIn(Object.values(MaterialStatus))
  status?: MaterialStatus

  @ApiPropertyOptional({ description: 'Ombor bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  warehouseId?: string
}

export class MaterialLineDto {
  @ApiPropertyOptional({ description: 'Ombor pozitsiyasi identifikatori' })
  @IsOptional()
  @IsString()
  warehouseItemId?: string

  @ApiProperty() @IsString() @IsNotEmpty() name!: string
  @ApiProperty() @IsString() @IsNotEmpty() unit!: string

  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) qty!: number
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) price!: number
}

export class CreateMaterialRequestDto {
  @ApiProperty({ description: 'Ish topshirig‘i identifikatori' })
  @IsString()
  @IsNotEmpty()
  workOrderId!: string

  @ApiPropertyOptional({ description: 'Ombor identifikatori' })
  @IsOptional()
  @IsString()
  warehouseId?: string

  @ApiProperty({ type: [MaterialLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialLineDto)
  lines!: MaterialLineDto[]
}

export class RejectMaterialRequestDto {
  @ApiProperty({ description: 'Rad etish sababi' })
  @IsString()
  @IsNotEmpty({ message: 'Sabab kiritilishi kerak' })
  reason!: string
}
