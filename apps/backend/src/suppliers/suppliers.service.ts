import { Injectable, NotFoundException } from '@nestjs/common';
import type { SupplierInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // Powers the Go To bar's live supplier search — same shape as
  // CustomersService.search().
  search(query: string) {
    return this.prisma.supplier.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
  }

  async get(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { purchaseOrders: true, purchaseBills: true },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  create(input: SupplierInput) {
    return this.prisma.supplier.create({ data: input });
  }

  async update(id: string, input: Partial<SupplierInput>) {
    await this.get(id);
    return this.prisma.supplier.update({ where: { id }, data: input });
  }
}
