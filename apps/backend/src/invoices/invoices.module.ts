import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service.js';
import { InvoicesController } from './invoices.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';

@Module({
  imports: [PaymentsModule, LedgerModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
