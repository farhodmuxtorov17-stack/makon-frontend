import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { PasswordService } from './password.service'
import { TokenService } from './token.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { OTP_SENDER, type OtpSender } from './otp/otp-sender.interface'
import { LogOtpSender } from './otp/log-otp-sender.service'
import { TelegramOtpSender } from './otp/telegram-otp-sender.service'

/**
 * Kodni yetkazish kanali OTP_SENDER o‘zgaruvchisi bilan tanlanadi.
 * Yangi kanal qo‘shilganda faqat shu tanlov kengaytiriladi.
 */
@Module({
  imports: [PassportModule, JwtModule.register({}), ConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    JwtStrategy,
    LogOtpSender,
    TelegramOtpSender,
    {
      provide: OTP_SENDER,
      inject: [ConfigService, LogOtpSender, TelegramOtpSender],
      useFactory: (
        config: ConfigService,
        log: LogOtpSender,
        telegram: TelegramOtpSender,
      ): OtpSender => (config.get<string>('otp.sender') === 'telegram' ? telegram : log),
    },
  ],
  exports: [AuthService, TokenService, PasswordService],
})
export class AuthModule {}
