import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { InvoicePaymentsController, PaymentsController } from './payments.controller.js';
import { LedgerModule } from '../ledger/ledger.module.js';

@Module({
  imports: [LedgerModule],
  controllers: [InvoicePaymentsController, PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
