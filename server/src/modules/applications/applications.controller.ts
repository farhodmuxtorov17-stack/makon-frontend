import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { ApplicationsService } from './applications.service'
import { CurrentUser, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { ApplicationQueryDto } from './dto/application.dto'

@ApiTags('Arizalar')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({
    summary: 'Ariza reyestri',
    description:
      'Bino rahbari faqat o‘z binolarini, ijarachi faqat o‘z tashkiloti arizalarini ko‘radi.',
  })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ApplicationQueryDto) {
    return this.applications.list(user, query)
  }

  @Get('summary')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Ariza hisoblagichlari' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.applications.summary(user)
  }

  @Get(':id')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Bitta ariza' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.applications.findOne(user, id)
  }
}
