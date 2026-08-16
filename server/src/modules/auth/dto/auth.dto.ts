import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { OrganizationKind } from '@prisma/client'
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator'

/** O‘zbekiston raqami: +998 XX XXX XX XX, oraliqlar ixtiyoriy. */
const PHONE_PATTERN = /^\+?998[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/

export class LoginDto {
  @ApiProperty({ description: 'Xodim logini', example: 's.yuldoshev' })
  @IsString()
  @IsNotEmpty({ message: 'Login kiritilishi kerak' })
  login!: string

  @ApiProperty({ description: 'Parol' })
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 belgidan iborat bo‘lishi kerak' })
  password!: string
}

export class RegisterPhoneDto {
  @ApiProperty({ description: 'Telefon raqami', example: '+998 90 123 45 67' })
  @Matches(PHONE_PATTERN, { message: 'Telefon raqami noto‘g‘ri formatda' })
  phone!: string
}

export class RegisterVerifyDto {
  @ApiProperty({ description: 'Telefon raqami', example: '+998 90 123 45 67' })
  @Matches(PHONE_PATTERN, { message: 'Telefon raqami noto‘g‘ri formatda' })
  phone!: string

  @ApiProperty({ description: 'Telefonga yuborilgan olti xonali kod', example: '000000' })
  @IsString()
  @Length(4, 8, { message: 'Kod noto‘g‘ri uzunlikda' })
  code!: string
}

export class RegisterCompleteDto {
  @ApiProperty({ description: 'Tekshiruvdan keyin berilgan qisqa muddatli token' })
  @IsString()
  @IsNotEmpty()
  registrationToken!: string

  @ApiProperty({ enum: OrganizationKind, description: 'Akkaunt turi: jismoniy yoki yuridik shaxs' })
  @IsEnum(OrganizationKind)
  kind!: OrganizationKind

  @ApiProperty({ description: 'Ism yoki kompaniya nomi' })
  @IsString()
  @IsNotEmpty({ message: 'Nom kiritilishi kerak' })
  name!: string

  @ApiPropertyOptional({ description: 'Yuridik shaxs uchun STIR' })
  @IsOptional()
  @IsString()
  tin?: string

  @ApiPropertyOptional({ description: 'Vakil, direktor' })
  @IsOptional()
  @IsString()
  director?: string

  @ApiPropertyOptional({ description: 'E-pochta' })
  @IsOptional()
  @IsEmail({}, { message: 'E-pochta noto‘g‘ri formatda' })
  email?: string

  @ApiPropertyOptional({ description: 'Yuridik manzil' })
  @IsOptional()
  @IsString()
  address?: string

  @ApiProperty({ description: 'Parol, kamida 8 belgi' })
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 belgidan iborat bo‘lishi kerak' })
  password!: string

  @ApiProperty({ description: 'Parolni tasdiqlash' })
  @IsString()
  @MinLength(8)
  passwordConfirmation!: string
}

export class RefreshDto {
  @ApiProperty({ description: 'Yangilash tokeni' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string
}

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Yangilash tokeni, berilsa faqat shu sessiya yopiladi' })
  @IsOptional()
  @IsString()
  refreshToken?: string
}

export class TokenPairDto {
  @ApiProperty() accessToken!: string
  @ApiProperty() refreshToken!: string
  @ApiProperty({ description: 'Kirish tokenining amal qilish muddati, sekund' })
  expiresIn!: number
}
