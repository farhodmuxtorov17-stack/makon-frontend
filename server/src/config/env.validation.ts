/**
 * Ilova ko‘tarilishidan oldin majburiy o‘zgaruvchilar tekshiriladi.
 * Yetishmayotgan qiymat bo‘lsa, jarayon tushunarli xato bilan to‘xtaydi.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing: string[] = []
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']

  for (const key of required) {
    const value = config[key]
    if (typeof value !== 'string' || value.trim().length === 0) missing.push(key)
  }

  if (missing.length > 0) {
    throw new Error(
      `Muhit sozlamalari to‘liq emas. Quyidagi o‘zgaruvchilar berilmagan: ${missing.join(', ')}. ` +
        '.env.example faylidan nusxa oling va qiymatlarni to‘ldiring.',
    )
  }

  const weak = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter(
    (key) => String(config[key]).length < 32,
  )
  if (weak.length > 0) {
    throw new Error(
      `Quyidagi kalitlar juda qisqa (kamida 32 belgi bo‘lishi kerak): ${weak.join(', ')}.`,
    )
  }

  if (config.OTP_SENDER === 'telegram' && !config.TELEGRAM_BOT_TOKEN) {
    throw new Error('OTP_SENDER=telegram bo‘lganda TELEGRAM_BOT_TOKEN majburiy.')
  }

  if (config.DIDOX_CLIENT === 'http' && (!config.DIDOX_BASE_URL || !config.DIDOX_API_KEY)) {
    throw new Error('DIDOX_CLIENT=http bo‘lganda DIDOX_BASE_URL va DIDOX_API_KEY majburiy.')
  }

  return config
}
