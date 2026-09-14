import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// One flat JSON dump of every core business entity — this business's scale
// doesn't need pagination or streaming. Deliberately excludes User/
// UserPersona (credentials) and ShowroomProfile isn't included either since
// it's config, not transactional data worth backing up separately from the
// deployment itself.
@Injectable()
export class DataExportService {
  constructor(private readonly prisma: PrismaService) {}

  async all() {
    const [
      customers,
      bikes,
      inventoryItems,
      serviceTickets,
      servicePartsUsed,
      serviceCharges,
      estimates,
      invoices,
      invoiceLineItems,
      payments,
      saleOrders,
      saleOrderLineItems,
      delegationTasks,
      auditLog,
    ] = await Promise.all([
      this.prisma.customer.findMany(),
      this.prisma.bike.findMany(),
      this.prisma.inventoryItem.findMany(),
      this.prisma.serviceTicket.findMany(),
      this.prisma.servicePartUsed.findMany(),
      this.prisma.serviceCharge.findMany(),
      this.prisma.estimate.findMany(),
      this.prisma.invoice.findMany(),
      this.prisma.invoiceLineItem.findMany(),
      this.prisma.payment.findMany(),
      this.prisma.saleOrder.findMany(),
      this.prisma.saleOrderLineItem.findMany(),
      this.prisma.delegationTask.findMany(),
      this.prisma.auditLog.findMany(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      customers,
      bikes,
      inventoryItems,
      serviceTickets,
      servicePartsUsed,
      serviceCharges,
      estimates,
      invoices,
      invoiceLineItems,
      payments,
      saleOrders,
      saleOrderLineItems,
      delegationTasks,
      auditLog,
    };
  }
}
