import { Module } from '@nestjs/common';
import { SupplierPaymentsService } from './supplier-payments.service.js';
import { PurchaseBillPaymentsController, SupplierPaymentsController } from './supplier-payments.controller.js';

@Module({
  controllers: [PurchaseBillPaymentsController, SupplierPaymentsController],
  providers: [SupplierPaymentsService],
  exports: [SupplierPaymentsService],
})
export class SupplierPaymentsModule {}
