import { Module } from '@nestjs/common'
import { LeaseController } from './lease.controller'
import { LeaseService } from './lease.service'
import { LeaseStateMachine } from './lease-state-machine'
import { ContractComposer } from './contract.composer'
import { DidoxModule } from '../didox/didox.module'

@Module({
  imports: [DidoxModule],
  controllers: [LeaseController],
  providers: [LeaseService, LeaseStateMachine, ContractComposer],
  exports: [LeaseService, LeaseStateMachine],
})
export class LeaseModule {}
