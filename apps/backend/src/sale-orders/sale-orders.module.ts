import { Module } from '@nestjs/common';
import { SaleOrdersService } from './sale-orders.service.js';
import { SaleOrdersController } from './sale-orders.controller.js';
import { InvoicesModule } from '../invoices/invoices.module.js';

@Module({
  imports: [InvoicesModule],
  controllers: [SaleOrdersController],
  providers: [SaleOrdersService],
})
export class SaleOrdersModule {}
