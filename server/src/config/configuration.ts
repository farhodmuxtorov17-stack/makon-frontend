/**
 * Muhit o‘zgaruvchilari bitta joyda o‘qiladi va tiplangan ko‘rinishga keltiriladi.
 * Kod ichida `process.env` ga to‘g‘ridan to‘g‘ri murojaat qilinmaydi:
 * har bir qiymat `ConfigService` orqali olinadi.
 */

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export interface MakonConfig {
  app: {
    env: string
    port: number
    corsOrigins: string[]
    swaggerPath: string
  }
  jwt: {
    accessSecret: string
    refreshSecret: string
    accessTtl: string
    refreshTtl: string
    registrationTtl: string
  }
  otp: {
    length: number
    ttlSeconds: number
    maxAttempts: number
    resendSeconds: number
    sender: string
    telegram: {
      botToken: string
      apiUrl: string
      resolverUrl: string
    }
  }
  didox: {
    client: string
    baseUrl: string
    apiKey: string
    tin: string
    timeoutMs: number
  }
  storage: {
    root: string
    maxUploadBytes: number
  }
}

export default (): MakonConfig => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: toInt(process.env.PORT, 4311),
    corsOrigins: toList(process.env.CORS_ORIGINS) ?? [],
    swaggerPath: process.env.SWAGGER_PATH ?? 'api/docs',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    registrationTtl: process.env.REGISTRATION_TOKEN_TTL ?? '15m',
  },
  otp: {
    length: toInt(process.env.OTP_LENGTH, 6),
    ttlSeconds: toInt(process.env.OTP_TTL_SECONDS, 300),
    maxAttempts: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
    resendSeconds: toInt(process.env.OTP_RESEND_SECONDS, 60),
    sender: process.env.OTP_SENDER ?? 'log',
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
      apiUrl: process.env.TELEGRAM_API_URL ?? 'https://api.telegram.org',
      resolverUrl: process.env.TELEGRAM_RESOLVER_URL ?? '',
    },
  },
  didox: {
    client: process.env.DIDOX_CLIENT ?? 'memory',
    baseUrl: process.env.DIDOX_BASE_URL ?? '',
    apiKey: process.env.DIDOX_API_KEY ?? '',
    tin: process.env.DIDOX_TIN ?? '',
    timeoutMs: toInt(process.env.DIDOX_TIMEOUT_MS, 15000),
  },
  storage: {
    root: process.env.STORAGE_ROOT ?? './storage',
    maxUploadBytes: toInt(process.env.MAX_UPLOAD_BYTES, 20 * 1024 * 1024),
  },
})
