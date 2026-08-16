import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { CurrentUser, Public } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import {
  LoginDto,
  LogoutDto,
  RefreshDto,
  RegisterCompleteDto,
  RegisterPhoneDto,
  RegisterVerifyDto,
  TokenPairDto,
} from './dto/auth.dto'

@ApiTags('Autentifikatsiya')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xodim kirishi',
    description: 'Login va parol. Rol hisobga biriktirilgan, so‘rovda rol tanlanmaydi.',
  })
  @ApiOkResponse({ type: TokenPairDto })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, request.headers['user-agent'])
  }

  @Public()
  @Post('register/phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ro‘yxatdan o‘tish, birinchi qadam',
    description: 'Telefon raqamiga bir martalik kod yuboriladi.',
  })
  requestOtp(@Body() dto: RegisterPhoneDto) {
    return this.auth.requestOtp(dto)
  }

  @Public()
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ro‘yxatdan o‘tish, ikkinchi qadam',
    description: 'Kod tekshiriladi va qisqa muddatli ro‘yxatdan o‘tish tokeni beriladi.',
  })
  verifyOtp(@Body() dto: RegisterVerifyDto) {
    return this.auth.verifyOtp(dto)
  }

  @Public()
  @Post('register/complete')
  @ApiOperation({
    summary: 'Ro‘yxatdan o‘tish, uchinchi qadam',
    description: 'Tashkilot va TENANT_OWNER rolidagi hisob yaratiladi.',
  })
  @ApiCreatedResponse({ type: TokenPairDto })
  complete(@Body() dto: RegisterCompleteDto, @Req() request: Request) {
    return this.auth.completeRegistration(dto, request.headers['user-agent'])
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kirish tokenini yangilash' })
  @ApiOkResponse({ type: TokenPairDto })
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.auth.refresh(dto.refreshToken, request.headers['user-agent'])
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sessiyani yopish',
    description: 'Yangilash tokeni berilsa faqat shu sessiya, aks holda barchasi yopiladi.',
  })
  logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto) {
    return this.auth.logout(user, dto.refreshToken)
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Joriy sessiya, rol, ko‘rish sohasi va huquqlar' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.profile(user)
  }
}
