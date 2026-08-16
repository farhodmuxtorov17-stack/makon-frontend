import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { WorkOrdersService } from './work-orders.service'
import { CurrentUser, RequireCapability, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import {
  CompleteWorkOrderDto,
  CreateMaterialRequestDto,
  MaterialRequestQueryDto,
  RejectMaterialRequestDto,
  UpdateWorkOrderProgressDto,
  WorkOrderQueryDto,
} from './dto/work-order.dto'

@ApiTags('Ish topshiriqlari')
@ApiBearerAuth()
@Controller()
export class WorkOrdersController {
  constructor(private readonly workOrders: WorkOrdersService) {}

  @Get('work-orders')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.FACILITY)
  @ApiOperation({ summary: 'Ish topshiriqlari ro‘yxati' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: WorkOrderQueryDto) {
    return this.workOrders.list(user, query)
  }

  @Get('work-orders/:id')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.FACILITY)
  @ApiOperation({ summary: 'Bitta ish topshirig‘i' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.workOrders.findOne(user, id)
  }

  @Post('work-orders/:id/start')
  @Roles(Role.FACILITY)
  @RequireCapability('workorder.execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ishni boshlash' })
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.workOrders.start(user, id)
  }

  @Post('work-orders/:id/progress')
  @Roles(Role.FACILITY)
  @RequireCapability('workorder.execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bajarilish darajasi va ishlar ro‘yxatini yangilash' })
  updateProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderProgressDto,
  ) {
    return this.workOrders.updateProgress(user, id, dto)
  }

  @Post('work-orders/:id/complete')
  @Roles(Role.FACILITY)
  @RequireCapability('workorder.execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ishni yakunlash va tasdiqlashga topshirish' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompleteWorkOrderDto,
  ) {
    return this.workOrders.complete(user, id, dto)
  }

  // --- Material so‘rovlari ---------------------------------------------------

  @Get('material-requests')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.FACILITY, Role.WAREHOUSE_OPERATOR)
  @ApiOperation({ summary: 'Material so‘rovlari ro‘yxati' })
  listMaterials(@CurrentUser() user: AuthenticatedUser, @Query() query: MaterialRequestQueryDto) {
    return this.workOrders.listMaterialRequests(user, query)
  }

  @Post('material-requests')
  @Roles(Role.FACILITY)
  @RequireCapability('workorder.execute')
  @ApiOperation({ summary: 'Material so‘rovi yuborish' })
  createMaterial(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMaterialRequestDto) {
    return this.workOrders.createMaterialRequest(user, dto)
  }

  @Post('material-requests/:id/approve')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('workorder.assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Material so‘rovini tasdiqlash' })
  approveMaterial(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.workOrders.approveMaterialRequest(user, id)
  }

  @Post('material-requests/:id/reject')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('workorder.assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Material so‘rovini rad etish' })
  rejectMaterial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectMaterialRequestDto,
  ) {
    return this.workOrders.rejectMaterialRequest(user, id, dto)
  }

  @Post('material-requests/:id/issue')
  @Roles(Role.WAREHOUSE_OPERATOR)
  @RequireCapability('warehouse.issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Materialni berish',
    description: 'Ombor qoldig‘i kamayadi va chiqim harakati yoziladi.',
  })
  issueMaterial(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.workOrders.issueMaterialRequest(user, id)
  }
}
