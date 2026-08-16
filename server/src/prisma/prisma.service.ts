import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

/**
 * Prisma ulanishi ilova hayotiy sikliga bog‘lanadi: modul ko‘tarilganda
 * ochiladi, to‘xtaganda yopiladi.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit(): Promise<void> {
    await this.$connect()
    this.logger.log('Ma’lumotlar bazasiga ulanish o‘rnatildi')
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
