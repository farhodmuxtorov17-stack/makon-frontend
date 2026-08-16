import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService)
  const logger = new Logger('MAKON')

  app.setGlobalPrefix('api', { exclude: ['health'] })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )

  const origins = config.get<string[]>('app.corsOrigins') ?? []
  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
  })

  const swaggerPath = config.get<string>('app.swaggerPath') ?? 'api/docs'
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('MAKON API')
      .setDescription(
        'Ko‘chmas mulk obyektlarini boshqarish tizimining dasturiy interfeysi. ' +
          'Obyekt reyestri, ijara sikli, billing, servis desk, ombor va hisobotlar.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build(),
  )
  SwaggerModule.setup(swaggerPath, app, document, {
    swaggerOptions: { persistAuthorization: true },
  })

  const port = config.get<number>('app.port') ?? 4311
  await app.listen(port)

  logger.log(`Xizmat ishga tushdi: http://localhost:${port}`)
  logger.log(`Interfeys tavsifi: http://localhost:${port}/${swaggerPath}`)
}

void bootstrap()
