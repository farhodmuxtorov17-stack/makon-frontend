import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { ReportsService } from './reports.service'
import { CurrentUser, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'

@ApiTags('Hisobotlar')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('portfolio')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Portfel ko‘rsatkichlari' })
  portfolio(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.portfolio(user)
  }

  @Get('occupancy')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Obyektlar kesimida bandlik' })
  occupancy(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.occupancy(user)
  }

  @Get('revenue')
  @Roles(Role.SUPER_HEAD, Role.ACCOUNTANT, Role.BUILDING_MANAGER)
  @ApiOperation({ summary: 'Tushum va qarzdorlik dinamikasi' })
  revenue(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.revenue(user)
  }

  @Get('service-kpi')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER)
  @ApiOperation({ summary: 'Servis desk ko‘rsatkichlari' })
  serviceKpi(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.serviceKpi(user)
  }
}
