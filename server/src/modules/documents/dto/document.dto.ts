import { ApiPropertyOptional } from '@nestjs/swagger'
import { DocumentKind } from '@prisma/client'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'

export class DocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DocumentKind })
  @IsOptional()
  @IsIn(Object.values(DocumentKind))
  kind?: DocumentKind

  @ApiPropertyOptional({ description: 'Shartnoma identifikatori' })
  @IsOptional()
  @IsString()
  contractId?: string

  @ApiPropertyOptional({ description: 'Ijara ishi identifikatori' })
  @IsOptional()
  @IsString()
  leaseCaseId?: string
}
