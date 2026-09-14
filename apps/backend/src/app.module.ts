import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { ShowroomProfileModule } from './showroom-profile/showroom-profile.module.js';
import { GstSlabsModule } from './gst-slabs/gst-slabs.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { BikesModule } from './bikes/bikes.module.js';
import { ServiceTicketsModule } from './service-tickets/service-tickets.module.js';
import { EstimatesModule } from './estimates/estimates.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { SaleOrdersModule } from './sale-orders/sale-orders.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module.js';
import { PurchaseBillsModule } from './purchase-bills/purchase-bills.module.js';
import { SupplierPaymentsModule } from './supplier-payments/supplier-payments.module.js';
import { DelegationTasksModule } from './delegation-tasks/delegation-tasks.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AuditLogModule } from './audit-log/audit-log.module.js';
import { DataExportModule } from './data-export/data-export.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ShowroomProfileModule,
    GstSlabsModule,
    CategoriesModule,
    AttendanceModule,
    InventoryModule,
    CustomersModule,
    BikesModule,
    ServiceTicketsModule,
    EstimatesModule,
    InvoicesModule,
    PaymentsModule,
    SaleOrdersModule,
    SuppliersModule,
    PurchaseOrdersModule,
    PurchaseBillsModule,
    SupplierPaymentsModule,
    DelegationTasksModule,
    ReportsModule,
    AuditLogModule,
    DataExportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
