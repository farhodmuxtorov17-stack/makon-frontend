import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { LeaseService } from './lease.service'
import { LeaseStateMachine } from './lease-state-machine'
import { CurrentUser, RequireCapability, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import {
  LeaseCaseQueryDto,
  MarkContactedDto,
  OfferTermsDto,
  RejectDto,
  ReturnForReworkDto,
  SubmitLeaseCaseDto,
  UploadSignedDocumentDto,
} from './dto/lease.dto'

@ApiTags('Ijara sikli')
@ApiBearerAuth()
@Controller('lease')
export class LeaseController {
  constructor(
    private readonly lease: LeaseService,
    private readonly machine: LeaseStateMachine,
  ) {}

  @Get('transitions')
  @ApiOperation({
    summary: 'Holat mashinasi',
    description: 'E’lon qilingan barcha o‘tishlar, ularning rollari va shartlari.',
  })
  transitions() {
    return this.machine.transitions()
  }

  @Get('cases')
  @Roles(
    Role.SUPER_HEAD,
    Role.BUILDING_MANAGER,
    Role.ACCOUNTANT,
    Role.TENANT_OWNER,
  )
  @ApiOperation({ summary: 'Ijara ishlari ro‘yxati, ko‘rish sohasi bo‘yicha cheklangan' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: LeaseCaseQueryDto) {
    return this.lease.list(user, query)
  }

  @Get('cases/:id')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Bitta ijara ishi' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lease.findOne(user, id)
  }

  @Get('cases/:id/audit')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Ijara ishining amallar tarixi' })
  trail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lease.trail(user, id)
  }

  @Post('cases')
  @Roles(Role.TENANT_OWNER)
  @ApiOperation({ summary: '1-bosqich: ijarachi ariza yuboradi' })
  @ApiConflictResponse({ description: 'Unit bo‘sh emas yoki rol amalni bajara olmaydi' })
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitLeaseCaseDto) {
    return this.lease.submit(user, dto)
  }

  @Post('cases/:id/contacted')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('application.decide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2-bosqich: operator bog‘landi' })
  markContacted(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MarkContactedDto,
  ) {
    return this.lease.markContacted(user, id, dto)
  }

  @Put('cases/:id/offer')
  @Roles(Role.BUILDING_MANAGER, Role.ACCOUNTANT)
  @RequireCapability('application.decide')
  @ApiOperation({
    summary: 'Kelishilgan shartlarni saqlash',
    description: 'To‘lov grafigi kirish qiymatlari o‘zgarishi bilan qayta hisoblanadi.',
  })
  saveOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: OfferTermsDto,
  ) {
    return this.lease.saveOffer(user, id, dto)
  }

  @Post('cases/:id/offer/approve')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('application.decide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '3-bosqich: operatsion tasdiq' })
  @ApiConflictResponse({ description: 'Noto‘g‘ri holat yoki rol' })
  approveOperation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: OfferTermsDto,
  ) {
    return this.lease.approveOperation(user, id, dto)
  }

  @Post('cases/:id/finance/approve')
  @Roles(Role.ACCOUNTANT)
  @RequireCapability('application.decide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '4-bosqich: moliyaviy tasdiq' })
  @ApiConflictResponse({ description: 'Noto‘g‘ri holat yoki rol' })
  approveFinance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: OfferTermsDto,
  ) {
    return this.lease.approveFinance(user, id, dto)
  }

  @Post('cases/:id/contract')
  @Roles(Role.BUILDING_MANAGER, Role.ACCOUNTANT)
  @RequireCapability('contract.sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '5-bosqich: shartnoma qoralamasi tuziladi' })
  composeContract(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lease.composeContract(user, id)
  }

  @Get('cases/:id/contract/preview')
  @Roles(Role.SUPER_HEAD, Role.BUILDING_MANAGER, Role.ACCOUNTANT, Role.TENANT_OWNER)
  @ApiOperation({ summary: 'Shartnoma qoralamasining matni' })
  @ApiOkResponse({ description: 'Formatlangan shartnoma matni' })
  contractPreview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lease.contractPreview(user, id)
  }

  @Post('cases/:id/didox/send')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('contract.sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '6-bosqich: hujjat Didox orqali yuboriladi',
    description: 'Imzolash Didox tomonida bajariladi, tizim faqat holatni kuzatadi.',
  })
  sendToDidox(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lease.sendToDidox(user, id)
  }

  @Post('cases/:id/didox/check')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('contract.sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '7-bosqich: Didox holatini tekshirish' })
  checkDidox(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lease.checkDidox(user, id)
  }

  @Post('cases/:id/documents/signed')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('contract.sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '8-bosqich: imzolangan hujjatni yuklash',
    description: 'Faylning SHA-256 nazorat yig‘indisi hujjat butunligini tasdiqlaydi.',
  })
  uploadSigned(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UploadSignedDocumentDto,
  ) {
    return this.lease.uploadSigned(user, id, dto)
  }

  @Delete('cases/:id/documents/signed')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('contract.sign')
  @ApiOperation({ summary: 'Yuklangan imzolangan hujjatni olib tashlash' })
  removeSigned(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lease.removeSigned(user, id)
  }

  @Post('cases/:id/activate')
  @Roles(Role.BUILDING_MANAGER)
  @RequireCapability('contract.sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Faollashtirish',
    description:
      'Bitta tranzaksiyada: unit «Ijarada» ga o‘tadi, katalogdan yashiriladi, bino ' +
      'statistikasi qayta hisoblanadi, shartnoma faollashadi va birinchi hisob-faktura yaratiladi.',
  })
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lease.activate(user, id)
  }

  @Post('cases/:id/reject')
  @Roles(Role.BUILDING_MANAGER, Role.ACCOUNTANT)
  @RequireCapability('application.decide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Arizani rad etish, sabab majburiy' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectDto,
  ) {
    return this.lease.reject(user, id, dto)
  }

  @Post('cases/:id/return')
  @Roles(Role.BUILDING_MANAGER, Role.ACCOUNTANT)
  @RequireCapability('application.decide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Oldingi bosqichga qaytarish, sabab majburiy' })
  returnForRework(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReturnForReworkDto,
  ) {
    return this.lease.returnForRework(user, id, dto)
  }
}
