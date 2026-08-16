import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { PrismaService } from '../../prisma/prisma.service'
import { Public } from '../../common/decorators'

@ApiTags('Holat')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Xizmat va ma’lumotlar bazasi holati' })
  async check() {
    let database = 'ok'
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      database = 'unavailable'
    }

    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      at: new Date().toISOString(),
    }
  }
}
