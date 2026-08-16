import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { AuditService } from './audit.service'
import { Roles } from '../../common/decorators'
import { PaginationQueryDto } from '../../common/dto/pagination.dto'
import { AuditQueryDto } from './dto/audit-query.dto'

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(Role.SUPER_HEAD)
  @ApiOperation({ summary: 'Audit jurnali, sahifalangan ro‘yxat' })
  @ApiOkResponse({ description: 'Amallar tarixi' })
  list(@Query() query: AuditQueryDto) {
    const pagination = new PaginationQueryDto()
    pagination.page = query.page
    pagination.limit = query.limit
    pagination.search = query.search
    return this.audit.list(pagination, {
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
    })
  }

  @Get(':entityType/:entityId')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Bitta yozuv bo‘yicha amallar tarixi' })
  trail(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.audit.trail(entityType, entityId)
  }
}
