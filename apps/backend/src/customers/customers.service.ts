import { Injectable, NotFoundException } from '@nestjs/common';
import type { CustomerInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // Powers the Go To bar's live customer search — same shape as
  // BikesService.search(): partial, case-insensitive, capped.
  search(query: string) {
    return this.prisma.customer.findMany({
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
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { bikes: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  create(input: CustomerInput) {
    return this.prisma.customer.create({ data: input });
  }

  async update(id: string, input: Partial<CustomerInput>) {
    await this.get(id);
    return this.prisma.customer.update({ where: { id }, data: input });
  }
}
