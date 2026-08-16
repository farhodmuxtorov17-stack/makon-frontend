import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { BuildingsService } from './buildings.service'
import { CurrentUser, RequireCapability, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { BuildingQueryDto, UpdateBuildingDto } from './dto/building.dto'

@ApiTags('Obyektlar')
@ApiBearerAuth()
@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  @Get()
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.CONTENT_OPERATOR, Role.ACCOUNTANT, Role.FACILITY)
  @ApiOperation({ summary: 'Obyektlar reyestri, ko‘rish sohasi bo‘yicha cheklangan' })
  @ApiForbiddenResponse({ description: 'Obyekt ko‘rish sohasiga kirmaydi' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: BuildingQueryDto) {
    return this.buildings.list(user, query)
  }

  @Get('portfolio')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Portfel yig‘masi' })
  portfolio(@CurrentUser() user: AuthenticatedUser) {
    return this.buildings.portfolio(user)
  }

  @Get(':id')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.CONTENT_OPERATOR, Role.ACCOUNTANT, Role.FACILITY)
  @ApiOperation({ summary: 'Bitta obyekt, identifikator, slug yoki kod bo‘yicha' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.buildings.findOne(user, id)
  }

  @Get(':id/floors')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.CONTENT_OPERATOR)
  @ApiOperation({ summary: 'Obyekt qavatlari' })
  floors(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.buildings.floors(user, id)
  }

  @Get(':id/stats')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Obyekt ko‘rsatkichlari: bandlik, bo‘sh maydon, qarzdorlik' })
  stats(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.buildings.stats(user, id)
  }

  @Patch(':id')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER)
  @RequireCapability('unit.editTechnical')
  @ApiOperation({ summary: 'Obyekt ma’lumotlarini tahrirlash' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBuildingDto,
  ) {
    return this.buildings.update(user, id, dto)
  }
}
