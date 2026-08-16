import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { OtpSender } from './otp-sender.interface'

/**
 * INTEGRATSIYA NUQTASI: Telegram orqali kod yuborish.
 *
 * Kerakli muhit o‘zgaruvchilari:
 *   TELEGRAM_BOT_TOKEN     bot kaliti, BotFather beradi
 *   TELEGRAM_API_URL       bot API manzili, odatda https://api.telegram.org
 *   TELEGRAM_RESOLVER_URL  telefon raqamini chat identifikatoriga aylantiruvchi
 *                          ichki xizmat manzili
 *
 * Telegram bot API telefon raqami bo‘yicha to‘g‘ridan to‘g‘ri xabar yubora
 * olmaydi: foydalanuvchi avval bot bilan suhbatni boshlaydi va raqamini
 * ulashadi, shundan keyin uning `chat_id` si ma’lum bo‘ladi. Shu bog‘lanishni
 * saqlaydigan xizmat manzili `TELEGRAM_RESOLVER_URL` da beriladi.
 *
 * Ulash tartibi:
 *   1. `resolveChatId` ichidagi TODO(integration) o‘rniga ichki xizmat
 *      chaqiruvi yoziladi.
 *   2. `send` ichidagi `sendMessage` chaqiruvi allaqachon tayyor, faqat
 *      xabar matni buyurtmachi talabiga moslanadi.
 *   3. `.env` da OTP_SENDER=telegram qilinadi.
 */
@Injectable()
export class TelegramOtpSender implements OtpSender {
  readonly channel = 'telegram'

  private readonly logger = new Logger(TelegramOtpSender.name)

  constructor(private readonly config: ConfigService) {}

  async send(input: { phone: string; code: string; ttlSeconds: number }): Promise<void> {
    const botToken = this.config.get<string>('otp.telegram.botToken') ?? ''
    const apiUrl = this.config.get<string>('otp.telegram.apiUrl') ?? ''

    if (!botToken || !apiUrl) {
      throw new ServiceUnavailableException(
        'Telegram orqali kod yuborish sozlanmagan. TELEGRAM_BOT_TOKEN va TELEGRAM_API_URL qiymatlarini to‘ldiring.',
      )
    }

    const chatId = await this.resolveChatId(input.phone)
    if (!chatId) {
      throw new ServiceUnavailableException(
        'Bu telefon raqami Telegram akkaunti bilan bog‘lanmagan. Avval bot bilan suhbatni boshlang.',
      )
    }

    const minutes = Math.max(1, Math.round(input.ttlSeconds / 60))
    const text =
      `MAKON tizimiga kirish kodi: ${input.code}\n` +
      `Kod ${minutes} daqiqa amal qiladi. Kodni hech kimga aytmang.`

    const response = await fetch(`${apiUrl}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })

    if (!response.ok) {
      this.logger.error(`Telegram javobi: ${response.status}`)
      throw new ServiceUnavailableException('Kodni yuborib bo‘lmadi, birozdan keyin qayta urinib ko‘ring.')
    }
  }

  /**
   * Telefon raqamiga bog‘langan Telegram chat identifikatorini qaytaradi.
   *
   * TODO(integration): TELEGRAM_RESOLVER_URL manzilidagi ichki xizmatga
   * so‘rov yuborilsin. Haqiqiy yo‘l va javob sxemasi buyurtmachi tomonidan
   * beriladi, shuning uchun bu yerda taxminiy manzil yozilmaydi.
   */
  private async resolveChatId(phone: string): Promise<string | null> {
    const resolverUrl = this.config.get<string>('otp.telegram.resolverUrl') ?? ''
    if (!resolverUrl) {
      this.logger.warn(
        `TELEGRAM_RESOLVER_URL berilmagan, ${phone} raqami uchun chat identifikatori aniqlanmadi`,
      )
      return null
    }
    return null
  }
}
