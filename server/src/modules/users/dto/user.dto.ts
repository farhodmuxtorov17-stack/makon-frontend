import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

const PHONE_PATTERN = /^\+?998[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role

  @ApiPropertyOptional({ description: 'Faqat faol hisoblar' })
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string
}

export class CreateUserDto {
  @ApiProperty({ description: 'Login' })
  @IsString()
  @IsNotEmpty({ message: 'Login kiritilishi kerak' })
  login!: string

  @ApiProperty({ description: 'To‘liq ism' })
  @IsString()
  @IsNotEmpty({ message: 'Ism kiritilishi kerak' })
  fullName!: string

  @ApiProperty({ enum: Role, description: 'Rol hisobga biriktiriladi' })
  @IsIn(Object.values(Role))
  role!: Role

  @ApiProperty({ description: 'Telefon raqami' })
  @Matches(PHONE_PATTERN, { message: 'Telefon raqami noto‘g‘ri formatda' })
  phone!: string

  @ApiPropertyOptional({ description: 'E-pochta' })
  @IsOptional()
  @IsEmail({}, { message: 'E-pochta noto‘g‘ri formatda' })
  email?: string

  @ApiPropertyOptional({ description: 'Lavozim' })
  @IsOptional()
  @IsString()
  position?: string

  @ApiProperty({ description: 'Boshlang‘ich parol, kamida 8 belgi' })
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 belgidan iborat bo‘lishi kerak' })
  password!: string

  @ApiPropertyOptional({ type: [String], description: 'Ko‘rish sohasidagi binolar' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  buildingScope?: string[]

  @ApiPropertyOptional({ type: [String], description: 'Biriktirilgan omborlar' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warehouseScope?: string[]
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() position?: string

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'E-pochta noto‘g‘ri formatda' })
  email?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  buildingScope?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warehouseScope?: string[]

  @ApiPropertyOptional({ description: 'Hisob faolligi' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Yangi parol, kamida 8 belgi' })
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 belgidan iborat bo‘lishi kerak' })
  password!: string
}
