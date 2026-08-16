import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { ServiceDeskService } from './service-desk.service'
import { CurrentUser, RequireCapability, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import {
  AssignServiceRequestDto,
  ChangeServiceStatusDto,
  CreateServiceRequestDto,
  ServiceRequestQueryDto,
} from './dto/service-request.dto'

@ApiTags('Servis desk')
@ApiBearerAuth()
@Controller('service-requests')
export class ServiceDeskController {
  constructor(private readonly serviceDesk: ServiceDeskService) {}

  @Get()
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.FACILITY, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Servis arizalari ro‘yxati' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ServiceRequestQueryDto) {
    return this.serviceDesk.list(user, query)
  }

  @Get('kpi')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.FACILITY)
  @ApiOperation({ summary: 'Servis desk ko‘rsatkichlari' })
  kpi(@CurrentUser() user: AuthenticatedUser) {
    return this.serviceDesk.kpi(user)
  }

  @Get(':id')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.FACILITY, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Bitta servis arizasi' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.serviceDesk.findOne(user, id)
  }

  @Post()
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.TENANT_OWNER, Role.FACILITY)
  @ApiOperation({ summary: 'Servis arizasi yaratish' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateServiceRequestDto) {
    return this.serviceDesk.create(user, dto)
  }

  @Post(':id/triage')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('workorder.assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Arizani ko‘rib chiqishga olish' })
  triage(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.serviceDesk.triage(user, id)
  }

  @Post(':id/assign')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('workorder.assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ijrochi biriktirish va ish topshirig‘ini ochish' })
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignServiceRequestDto,
  ) {
    return this.serviceDesk.assign(user, id, dto)
  }

  @Post(':id/status')
  @Roles(Role.BUILDING_MANAGER, Role.FACILITY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ariza holatini o‘zgartirish' })
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ChangeServiceStatusDto,
  ) {
    return this.serviceDesk.changeStatus(user, id, dto)
  }
}
