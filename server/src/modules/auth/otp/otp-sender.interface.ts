/**
 * Bir martalik kodni yetkazish nuqtasi.
 *
 * Integratsiya shu interfeys orqali ulanadi: yangi kanal qo‘shish uchun
 * shu shartnomani bajaruvchi sinf yozilib, `AuthModule` da ro‘yxatdan
 * o‘tkaziladi. Boshqa kod o‘zgarmaydi.
 */
export interface OtpSender {
  /** Kanal nomi, jurnalga va sozlama tanloviga ishlatiladi. */
  readonly channel: string

  /**
   * Kodni yetkazadi. Yetkazib bo‘lmasa xato ko‘tariladi va chaqiruvchi
   * foydalanuvchiga tushunarli xabar qaytaradi.
   */
  send(input: { phone: string; code: string; ttlSeconds: number }): Promise<void>
}

export const OTP_SENDER = Symbol('MAKON_OTP_SENDER')
