import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import configuration from './config/configuration'
import { validateEnv } from './config/env.validation'
import { PrismaModule } from './prisma/prisma.module'
import { ScopeModule } from './common/scope/scope.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { CapabilitiesGuard } from './common/guards/capabilities.guard'
import { AuditModule } from './modules/audit/audit.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { BuildingsModule } from './modules/buildings/buildings.module'
import { UnitsModule } from './modules/units/units.module'
import { ApplicationsModule } from './modules/applications/applications.module'
import { LeaseModule } from './modules/lease/lease.module'
import { DidoxModule } from './modules/didox/didox.module'
import { ContractsModule } from './modules/contracts/contracts.module'
import { BillingModule } from './modules/billing/billing.module'
import { ServiceDeskModule } from './modules/service-desk/service-desk.module'
import { WorkOrdersModule } from './modules/work-orders/work-orders.module'
import { WarehouseModule } from './modules/warehouse/warehouse.module'
import { MetersModule } from './modules/meters/meters.module'
import { ReportsModule } from './modules/reports/reports.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { HealthModule } from './modules/health/health.module'

/**
 * Qo‘riqchilar global tartibda ulanadi va aynan shu ketma-ketlikda ishlaydi:
 * token, keyin rol, keyin amal huquqi.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    ScopeModule,
    AuditModule,
    AuthModule,
    UsersModule,
    BuildingsModule,
    UnitsModule,
    ApplicationsModule,
    DidoxModule,
    LeaseModule,
    ContractsModule,
    BillingModule,
    ServiceDeskModule,
    WorkOrdersModule,
    WarehouseModule,
    MetersModule,
    ReportsModule,
    NotificationsModule,
    DocumentsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CapabilitiesGuard },
  ],
})
export class AppModule {}
