import { Injectable, Logger } from '@nestjs/common'
import type { OtpSender } from './otp-sender.interface'

/**
 * Mahalliy ishlab chiqish uchun yetkazish kanali: kod tashqi xizmatga
 * yuborilmaydi, server jurnaliga yoziladi. Ishlab chiqarish muhitida
 * OTP_SENDER=telegram qilib qo‘yiladi.
 */
@Injectable()
export class LogOtpSender implements OtpSender {
  readonly channel = 'log'

  private readonly logger = new Logger(LogOtpSender.name)

  async send(input: { phone: string; code: string; ttlSeconds: number }): Promise<void> {
    this.logger.log(
      `${input.phone} raqami uchun kod: ${input.code}, amal qilish muddati ${input.ttlSeconds} sekund`,
    )
  }
}
