import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { InvoiceStatus, PaymentMethod, PaymentStatus } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export class InvoiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsIn(Object.values(InvoiceStatus))
  status?: InvoiceStatus

  @ApiPropertyOptional({ description: 'Bino bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  buildingId?: string

  @ApiPropertyOptional({ description: 'Hisob-kitob davri kodi, masalan 2026-08' })
  @IsOptional()
  @IsString()
  period?: string

  @ApiPropertyOptional({ description: 'Qarzdorlik yoshi: 0-30, 31-60, 61-90, 90+' })
  @IsOptional()
  @IsIn(['0-30', '31-60', '61-90', '90+'])
  agingBucket?: string
}

export class InvoiceLineDto {
  @ApiProperty() @IsString() @IsNotEmpty() service!: string
  @ApiProperty() @IsString() @IsNotEmpty() unit!: string

  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) tariff!: number
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) qty!: number
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Shartnoma identifikatori' })
  @IsString()
  @IsNotEmpty()
  contractId!: string

  @ApiProperty({ description: 'Davr nomi', example: 'Avgust 2026' })
  @IsString()
  @IsNotEmpty()
  periodLabel!: string

  @ApiProperty({ description: 'To‘lov muddati', example: '2026-09-10' })
  @IsDateString()
  dueAt!: string

  @ApiProperty({ type: [InvoiceLineDto], description: 'Hisob-faktura satrlari' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[]

  @ApiPropertyOptional({ description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string
}

export class CancelInvoiceDto {
  @ApiProperty({ description: 'Bekor qilish sababi' })
  @IsString()
  @IsNotEmpty({ message: 'Sabab kiritilishi kerak' })
  reason!: string
}

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsIn(Object.values(PaymentStatus))
  status?: PaymentStatus

  @ApiPropertyOptional({ description: 'Hisob-faktura identifikatori' })
  @IsOptional()
  @IsString()
  invoiceId?: string
}

export class RegisterPaymentDto {
  @ApiProperty({ description: 'Hisob-faktura identifikatori' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string

  @ApiProperty({ description: 'To‘lov summasi, so‘m' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number

  @ApiProperty({ enum: PaymentMethod })
  @IsIn(Object.values(PaymentMethod))
  method!: PaymentMethod

  @ApiProperty({ description: 'To‘lov sanasi', example: '2026-08-16' })
  @IsDateString()
  paidAt!: string

  @ApiPropertyOptional({ description: 'To‘lov topshirig‘i raqami' })
  @IsOptional()
  @IsString()
  reference?: string
}

export class RejectPaymentDto {
  @ApiProperty({ description: 'Rad etish sababi' })
  @IsString()
  @IsNotEmpty({ message: 'Sabab kiritilishi kerak' })
  reason!: string
}

export class DebtQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Bino bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  buildingId?: string

  @ApiPropertyOptional({ description: 'Qarzdorlik yoshi' })
  @IsOptional()
  @IsIn(['0-30', '31-60', '61-90', '90+'])
  agingBucket?: string
}
