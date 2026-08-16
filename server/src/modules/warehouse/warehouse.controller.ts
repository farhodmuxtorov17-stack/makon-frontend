import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { WarehouseService } from './warehouse.service'
import { CurrentUser, RequireCapability, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import {
  CreateInventorySessionDto,
  CreateStockMovementDto,
  StockMovementQueryDto,
  SubmitInventoryCountDto,
  WarehouseItemQueryDto,
} from './dto/warehouse.dto'

@ApiTags('Ombor')
@ApiBearerAuth()
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}

  @Get()
  @Roles(Role.SUPER_HEAD, Role.WAREHOUSE_OPERATOR)
  @ApiOperation({ summary: 'Omborlar ro‘yxati' })
  listWarehouses(@CurrentUser() user: AuthenticatedUser) {
    return this.warehouse.listWarehouses(user)
  }

  @Get('summary')
  @Roles(Role.SUPER_HEAD, Role.WAREHOUSE_OPERATOR)
  @ApiOperation({ summary: 'Ombor yig‘ma ko‘rsatkichlari' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.warehouse.summary(user)
  }

  @Get('items')
  @Roles(Role.SUPER_HEAD, Role.WAREHOUSE_OPERATOR)
  @ApiOperation({ summary: 'Ombor qoldig‘i' })
  listItems(@CurrentUser() user: AuthenticatedUser, @Query() query: WarehouseItemQueryDto) {
    return this.warehouse.listItems(user, query)
  }

  @Get('items/:id')
  @Roles(Role.SUPER_HEAD, Role.WAREHOUSE_OPERATOR)
  @ApiOperation({ summary: 'Bitta pozitsiya va uning harakatlari' })
  findItem(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.warehouse.findItem(user, id)
  }

  @Get('movements')
  @Roles(Role.SUPER_HEAD, Role.WAREHOUSE_OPERATOR)
  @ApiOperation({ summary: 'Kirim va chiqim harakatlari' })
  listMovements(@CurrentUser() user: AuthenticatedUser, @Query() query: StockMovementQueryDto) {
    return this.warehouse.listMovements(user, query)
  }

  @Post('movements')
  @Roles(Role.WAREHOUSE_OPERATOR)
  @RequireCapability('warehouse.issue')
  @ApiOperation({ summary: 'Kirim yoki chiqim harakatini yozish' })
  createMovement(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStockMovementDto) {
    return this.warehouse.createMovement(user, dto)
  }

  @Get('inventory')
  @Roles(Role.SUPER_HEAD, Role.WAREHOUSE_OPERATOR)
  @ApiOperation({ summary: 'Inventarizatsiya seanslari' })
  listInventory(@CurrentUser() user: AuthenticatedUser) {
    return this.warehouse.listInventorySessions(user)
  }

  @Get('inventory/:id')
  @Roles(Role.SUPER_HEAD, Role.WAREHOUSE_OPERATOR)
  @ApiOperation({ summary: 'Inventarizatsiya tafsilotlari' })
  inventoryDetails(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.warehouse.inventoryDetails(user, id)
  }

  @Post('inventory')
  @Roles(Role.WAREHOUSE_OPERATOR)
  @RequireCapability('warehouse.issue')
  @ApiOperation({ summary: 'Inventarizatsiyani boshlash' })
  openInventory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInventorySessionDto) {
    return this.warehouse.openInventorySession(user, dto)
  }

  @Post('inventory/:id/count')
  @Roles(Role.WAREHOUSE_OPERATOR)
  @RequireCapability('warehouse.issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sanoq natijalarini kiritish' })
  submitCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitInventoryCountDto,
  ) {
    return this.warehouse.submitCount(user, id, dto)
  }

  @Post('inventory/:id/close')
  @Roles(Role.WAREHOUSE_OPERATOR)
  @RequireCapability('warehouse.issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inventarizatsiyani yopish va qoldiqni moslashtirish' })
  closeInventory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.warehouse.closeInventorySession(user, id)
  }
}
