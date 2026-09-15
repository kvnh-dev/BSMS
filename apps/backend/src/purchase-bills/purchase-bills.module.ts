import { Module } from '@nestjs/common';
import { PurchaseBillsService } from './purchase-bills.service.js';
import { PurchaseBillsController } from './purchase-bills.controller.js';
import { SupplierPaymentsModule } from '../supplier-payments/supplier-payments.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';

@Module({
  imports: [SupplierPaymentsModule, LedgerModule],
  controllers: [PurchaseBillsController],
  providers: [PurchaseBillsService],
  exports: [PurchaseBillsService],
})
export class PurchaseBillsModule {}
