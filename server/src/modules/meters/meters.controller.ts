import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { MetersService } from './meters.service'
import { CurrentUser, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { CreateMeterReadingDto, MeterQueryDto } from './dto/meter.dto'

@ApiTags('Hisoblagichlar')
@ApiBearerAuth()
@Controller('meters')
export class MetersController {
  constructor(private readonly meters: MetersService) {}

  @Get()
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.FACILITY, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Hisoblagichlar ro‘yxati' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: MeterQueryDto) {
    return this.meters.list(user, query)
  }

  @Get('utility-summary')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.FACILITY)
  @ApiOperation({ summary: 'Kommunal sarf yig‘masi' })
  utilitySummary(@CurrentUser() user: AuthenticatedUser) {
    return this.meters.utilitySummary(user)
  }

  @Get(':id')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.FACILITY, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Bitta hisoblagich' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.meters.findOne(user, id)
  }

  @Get(':id/readings')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.FACILITY, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Ko‘rsatkichlar tarixi' })
  readings(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.meters.readings(user, id)
  }

  @Post(':id/readings')
  @Roles(Role.BUILDING_MANAGER, Role.FACILITY)
  @ApiOperation({ summary: 'Yangi ko‘rsatkich kiritish' })
  addReading(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateMeterReadingDto,
  ) {
    return this.meters.addReading(user, id, dto)
  }
}
