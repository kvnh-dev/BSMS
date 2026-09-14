import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { ReportsController } from './reports.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { SupplierPaymentsModule } from '../supplier-payments/supplier-payments.module.js';

@Module({
  imports: [PaymentsModule, SupplierPaymentsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
