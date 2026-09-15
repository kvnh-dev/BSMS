import { Module } from '@nestjs/common';
import { SupplierPaymentsService } from './supplier-payments.service.js';
import { PurchaseBillPaymentsController, SupplierPaymentsController } from './supplier-payments.controller.js';
import { LedgerModule } from '../ledger/ledger.module.js';

@Module({
  imports: [LedgerModule],
  controllers: [PurchaseBillPaymentsController, SupplierPaymentsController],
  providers: [SupplierPaymentsService],
  exports: [SupplierPaymentsService],
})
export class SupplierPaymentsModule {}
