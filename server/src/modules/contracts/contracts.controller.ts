import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { ContractsService } from './contracts.service'
import { CurrentUser, RequireCapability, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { ContractQueryDto, TerminateContractDto } from './dto/contract.dto'

@ApiTags('Shartnomalar')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Shartnomalar reyestri' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ContractQueryDto) {
    return this.contracts.list(user, query)
  }

  @Get(':id')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Bitta shartnoma, identifikator yoki kod bo‘yicha' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.contracts.findOne(user, id)
  }

  @Get(':id/documents')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Shartnomaga biriktirilgan hujjatlar' })
  documents(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.contracts.documents(user, id)
  }

  @Post(':id/terminate')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER)
  @RequireCapability('contract.sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shartnomani bekor qilish, sabab majburiy' })
  terminate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TerminateContractDto,
  ) {
    return this.contracts.terminate(user, id, dto)
  }
}
