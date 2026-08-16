import { Injectable } from '@nestjs/common'
import { hash, verify } from '@node-rs/argon2'

/**
 * Parollar argon2id algoritmi bilan saqlanadi. Parametrlar OWASP tavsiyasiga
 * mos: 19 MiB xotira, uch marta takrorlash, bitta oqim.
 */
@Injectable()
export class PasswordService {
  private readonly options = {
    memoryCost: 19_456,
    timeCost: 3,
    parallelism: 1,
  }

  hash(plain: string): Promise<string> {
    return hash(plain, this.options)
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain, this.options)
    } catch {
      return false
    }
  }
}
