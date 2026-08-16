import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { BillingService } from './billing.service'
import { CurrentUser, RequireCapability, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import {
  CancelInvoiceDto,
  CreateInvoiceDto,
  DebtQueryDto,
  InvoiceQueryDto,
  PaymentQueryDto,
  RegisterPaymentDto,
  RejectPaymentDto,
} from './dto/billing.dto'

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // --- Hisob-fakturalar ------------------------------------------------------

  @Get('invoices')
  @Roles(Role.SUPER_HEAD, Role.ACCOUNTANT, Role.BUILDING_MANAGER, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Hisob-fakturalar ro‘yxati, ko‘rish sohasi bo‘yicha cheklangan' })
  listInvoices(@CurrentUser() user: AuthenticatedUser, @Query() query: InvoiceQueryDto) {
    return this.billing.listInvoices(user, query)
  }

  @Get('invoices/:id')
  @Roles(Role.SUPER_HEAD, Role.ACCOUNTANT, Role.BUILDING_MANAGER, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Bitta hisob-faktura, satrlari va to‘lovlari bilan' })
  findInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billing.findInvoice(user, id)
  }

  @Post('invoices')
  @Roles(Role.ACCOUNTANT)
  @RequireCapability('invoice.create')
  @ApiOperation({ summary: 'Hisob-faktura yaratish' })
  createInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.billing.createInvoice(user, dto)
  }

  @Post('invoices/:id/issue')
  @Roles(Role.ACCOUNTANT)
  @RequireCapability('invoice.create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hisob-fakturani tasdiqlash' })
  issueInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billing.issueInvoice(user, id)
  }

  @Post('invoices/:id/cancel')
  @Roles(Role.ACCOUNTANT)
  @RequireCapability('invoice.create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hisob-fakturani bekor qilish' })
  cancelInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelInvoiceDto,
  ) {
    return this.billing.cancelInvoice(user, id, dto)
  }

  // --- To‘lovlar -------------------------------------------------------------

  @Get('payments')
  @Roles(Role.SUPER_HEAD, Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'To‘lovlar ro‘yxati' })
  listPayments(@CurrentUser() user: AuthenticatedUser, @Query() query: PaymentQueryDto) {
    return this.billing.listPayments(user, query)
  }

  @Post('payments')
  @Roles(Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'To‘lovni qayd etish, tasdiqlash alohida amal' })
  registerPayment(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterPaymentDto) {
    return this.billing.registerPayment(user, dto)
  }

  @Post('payments/:id/confirm')
  @Roles(Role.ACCOUNTANT)
  @RequireCapability('payment.confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'To‘lovni tasdiqlash',
    description: 'Hisob-faktura qoldig‘i, to‘lov grafigi va qarzdorlik birgalikda yangilanadi.',
  })
  confirmPayment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billing.confirmPayment(user, id)
  }

  @Post('payments/:id/reject')
  @Roles(Role.ACCOUNTANT)
  @RequireCapability('payment.confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'To‘lovni rad etish' })
  rejectPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.billing.rejectPayment(user, id, dto)
  }

  // --- Qarzdorlik ------------------------------------------------------------

  @Get('debts')
  @Roles(Role.SUPER_HEAD, Role.ACCOUNTANT, Role.BUILDING_MANAGER)
  @ApiOperation({ summary: 'Qarzdorlik ro‘yxati' })
  listDebts(@CurrentUser() user: AuthenticatedUser, @Query() query: DebtQueryDto) {
    return this.billing.listDebts(user, query)
  }

  @Get('debts/aging')
  @Roles(Role.SUPER_HEAD, Role.ACCOUNTANT, Role.BUILDING_MANAGER)
  @ApiOperation({ summary: 'Qarzdorlik yoshi bo‘yicha taqsimot' })
  aging(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.aging(user)
  }

  @Post('debts/recalculate')
  @Roles(Role.ACCOUNTANT)
  @RequireCapability('invoice.create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kechikkan hisob-fakturalar bo‘yicha qarzdorlikni qayta hisoblash' })
  recalculate(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.recalculateDebts(user)
  }

  // --- Hisob-kitob davrlari --------------------------------------------------

  @Get('periods')
  @Roles(Role.SUPER_HEAD, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Hisob-kitob davrlari' })
  listPeriods() {
    return this.billing.listPeriods()
  }

  @Post('periods/:id/close')
  @Roles(Role.ACCOUNTANT)
  @RequireCapability('invoice.create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hisob-kitob davrini yopish' })
  closePeriod(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billing.closePeriod(user, id)
  }

  @Get('summary')
  @Roles(Role.SUPER_HEAD, Role.ACCOUNTANT, Role.BUILDING_MANAGER)
  @ApiOperation({ summary: 'Billing yig‘ma ko‘rsatkichlari' })
  summary(@CurrentUser() user: AuthenticatedUser, @Query('period') period?: string) {
    return this.billing.summary(user, period)
  }
}
