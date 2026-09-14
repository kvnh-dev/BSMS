import { Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { PurchaseOrdersController } from './purchase-orders.controller.js';
import { PurchaseBillsModule } from '../purchase-bills/purchase-bills.module.js';

@Module({
  imports: [PurchaseBillsModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
