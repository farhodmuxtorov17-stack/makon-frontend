import { Body, Controller, Get, Param, ParseIntPipe, Patch, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { UnitsService } from './units.service'
import { CurrentUser, Public, RequireCapability, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import {
  SavePolygonDto,
  UnitQueryDto,
  UpdateUnitContentDto,
  UpdateUnitTechnicalDto,
} from './dto/unit.dto'

@ApiTags('Unitlar')
@Controller()
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Public()
  @Get('catalog/units')
  @ApiOperation({
    summary: 'Ommaviy katalog: e’lon qilingan bo‘sh unitlar',
    description: 'Faollashtirilgan unit katalogdan avtomatik chiqib ketadi.',
  })
  catalog(@Query() query: UnitQueryDto) {
    return this.units.catalog(query)
  }

  @Public()
  @Get('catalog/units/:id')
  @ApiOperation({ summary: 'Katalogdagi bitta unit' })
  publicOne(@Param('id') id: string) {
    return this.units.publicOne(id)
  }

  @Get('units')
  @ApiBearerAuth()
  @Roles(
    Role.SUPER_HEAD,
    Role.BUILDING_MANAGER,
    Role.CONTENT_OPERATOR,
    Role.ACCOUNTANT,
    Role.FACILITY,
  )
  @ApiOperation({ summary: 'Unit reyestri, ko‘rish sohasi bo‘yicha cheklangan' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: UnitQueryDto) {
    return this.units.list(user, query)
  }

  @Get('units/:id')
  @ApiBearerAuth()
  @Roles(
    Role.SUPER_HEAD,
    Role.BUILDING_MANAGER,
    Role.CONTENT_OPERATOR,
    Role.ACCOUNTANT,
    Role.FACILITY,
  )
  @ApiOperation({ summary: 'Bitta unit' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.units.findOne(user, id)
  }

  @Get('buildings/:buildingId/floors/:floor/units')
  @ApiBearerAuth()
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.CONTENT_OPERATOR)
  @ApiOperation({ summary: 'Qavat rejasidagi unitlar va ularning ko‘pburchaklari' })
  floorUnits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('buildingId') buildingId: string,
    @Param('floor', ParseIntPipe) floor: number,
  ) {
    return this.units.floorUnits(user, buildingId, floor)
  }

  @Patch('units/:id/technical')
  @ApiBearerAuth()
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER)
  @RequireCapability('unit.editTechnical')
  @ApiOperation({ summary: 'Unit texnik holatini tahrirlash' })
  updateTechnical(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUnitTechnicalDto,
  ) {
    return this.units.updateTechnical(user, id, dto)
  }

  @Patch('units/:id/content')
  @ApiBearerAuth()
  @Roles(Role.CONTENT_OPERATOR)
  @RequireCapability('unit.editContent')
  @ApiOperation({ summary: 'Unit atributlarini tahrirlash' })
  updateContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUnitContentDto,
  ) {
    return this.units.updateContent(user, id, dto)
  }

  @Put('units/:id/polygon')
  @ApiBearerAuth()
  @Roles(Role.CONTENT_OPERATOR)
  @RequireCapability('unit.editContent')
  @ApiOperation({ summary: 'Qavat rejasidagi ko‘pburchakni saqlash' })
  savePolygon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SavePolygonDto,
  ) {
    return this.units.savePolygon(user, id, dto)
  }
}
