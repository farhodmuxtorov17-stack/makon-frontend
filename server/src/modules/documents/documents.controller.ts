import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { DocumentsService } from './documents.service'
import { CurrentUser } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { DocumentQueryDto } from './dto/document.dto'

@ApiTags('Hujjatlar')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Hujjatlar ro‘yxati',
    description: 'Ijarachi faqat o‘z tashkiloti hujjatlarini ko‘radi.',
  })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: DocumentQueryDto) {
    return this.documents.list(user, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta hujjat, nazorat yig‘indisi bilan' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documents.findOne(user, id)
  }
}
