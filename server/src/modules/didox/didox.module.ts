import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { DIDOX_CLIENT, type DidoxClient } from './didox-client.interface'
import { DidoxHttpClient } from './didox-http.client'
import { DidoxMemoryClient } from './didox-memory.client'

/**
 * Amalga oshirish DIDOX_CLIENT o‘zgaruvchisi bilan tanlanadi:
 * `http` haqiqiy xizmat, `memory` mahalliy ishlab chiqish.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    DidoxHttpClient,
    DidoxMemoryClient,
    {
      provide: DIDOX_CLIENT,
      inject: [ConfigService, DidoxHttpClient, DidoxMemoryClient],
      useFactory: (
        config: ConfigService,
        http: DidoxHttpClient,
        memory: DidoxMemoryClient,
      ): DidoxClient => (config.get<string>('didox.client') === 'http' ? http : memory),
    },
  ],
  exports: [DIDOX_CLIENT],
})
export class DidoxModule {}
