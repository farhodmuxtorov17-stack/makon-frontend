import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ContractStatus } from '@prisma/client'
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export class ContractQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsIn(Object.values(ContractStatus))
  status?: ContractStatus

  @ApiPropertyOptional({ description: 'Bino bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  buildingId?: string

  @ApiPropertyOptional({ description: 'Shartnoma turi: Ijara yoki Sotuv' })
  @IsOptional()
  @IsIn(['Ijara', 'Sotuv'])
  type?: string
}

export class TerminateContractDto {
  @ApiProperty({ description: 'Bekor qilish sababi' })
  @IsString()
  @IsNotEmpty({ message: 'Sabab kiritilishi kerak' })
  reason!: string
}
