import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { LeaseStatus } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import { PERIODICITY_VALUES } from '../schedule.builder'

export class SubmitLeaseCaseDto {
  @ApiProperty({ description: 'Tanlangan unit identifikatori' })
  @IsString()
  @IsNotEmpty()
  unitId!: string

  @ApiProperty({ description: 'Ariza turi', enum: ['Ijaraga olish', 'Sotib olish'] })
  @IsIn(['Ijaraga olish', 'Sotib olish'], { message: 'Ariza turi noto‘g‘ri' })
  requestType!: string

  @ApiProperty({ description: 'Taklif qilinayotgan narx, so‘m' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offerPrice!: number

  @ApiProperty({ description: 'Boshlanish sanasi', example: '2026-09-01' })
  @IsDateString({}, { message: 'Boshlanish sanasi noto‘g‘ri' })
  startDate!: string

  @ApiProperty({ description: 'Muddat, oy' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(360)
  term!: number

  @ApiPropertyOptional({ description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string
}

export class OfferTermsDto {
  @ApiProperty({ description: 'Oylik ijara narxi, so‘m' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRent!: number

  @ApiProperty({ description: 'Kafolat depoziti, so‘m' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deposit!: number

  @ApiProperty({ description: 'Servis to‘lovi, so‘m / m² / oy' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  servicePerSqm!: number

  @ApiProperty({ description: 'To‘lov davriyligi', enum: PERIODICITY_VALUES })
  @IsIn(PERIODICITY_VALUES, { message: 'To‘lov davriyligi noto‘g‘ri' })
  periodicity!: string

  @ApiPropertyOptional({ description: 'Shartlar tuzatilgan bo‘lsa, sababi' })
  @IsOptional()
  @IsString()
  adjustmentReason?: string
}

export class RejectDto {
  @ApiProperty({ description: 'Rad etish sababi' })
  @IsString()
  @IsNotEmpty({ message: 'Sabab kiritilishi kerak' })
  reason!: string
}

export class ReturnForReworkDto {
  @ApiProperty({ description: 'Qayta ishlashga yuborish sababi' })
  @IsString()
  @IsNotEmpty({ message: 'Sabab kiritilishi kerak' })
  reason!: string
}

export class MarkContactedDto {
  @ApiPropertyOptional({ description: 'Bog‘lanish natijasi haqida qisqacha' })
  @IsOptional()
  @IsString()
  note?: string
}

export class UploadSignedDocumentDto {
  @ApiProperty({ description: 'Fayl nomi', example: 'MKON-2026-0162-signed.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName!: string

  @ApiProperty({ description: 'Fayl hajmi, bayt' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size!: number

  @ApiProperty({ description: 'Fayl turi', example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string

  @ApiProperty({ description: 'Kengaytma', example: 'pdf' })
  @IsIn(['pdf', 'docx'], { message: 'Faqat pdf yoki docx qabul qilinadi' })
  extension!: string

  @ApiProperty({ description: 'Faylning SHA-256 nazorat yig‘indisi' })
  @Matches(/^[a-f0-9]{64}$/i, { message: 'Nazorat yig‘indisi SHA-256 formatida bo‘lishi kerak' })
  hash!: string

  @ApiPropertyOptional({ description: 'Saqlash joyidagi kalit' })
  @IsOptional()
  @IsString()
  storageKey?: string
}

export class LeaseCaseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LeaseStatus, description: 'Holat bo‘yicha filtr' })
  @IsOptional()
  @IsIn(Object.values(LeaseStatus))
  status?: LeaseStatus

  @ApiPropertyOptional({ description: 'Bino bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  buildingId?: string

  @ApiPropertyOptional({ description: 'Unit bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  unitId?: string

  @ApiPropertyOptional({ description: 'Faqat qaror kutayotgan yozuvlar' })
  @IsOptional()
  @IsIn(['true', 'false'])
  pending?: string
}
