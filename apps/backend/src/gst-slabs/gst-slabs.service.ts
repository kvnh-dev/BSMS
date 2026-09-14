import { Injectable } from '@nestjs/common';
import type { GstSlabInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';

// Standard Indian GST slabs, seeded on first run. The two-wheeler-relevant
// one (28%) is marked default. See DATABASE_SCHEMA.md's GstSlab model note.
const STANDARD_SLABS: GstSlabInput[] = [
  { label: 'Exempt', rate: 0, isDefault: false },
  { label: 'GST 0.25%', rate: 25, isDefault: false },
  { label: 'GST 3%', rate: 300, isDefault: false },
  { label: 'GST 5%', rate: 500, isDefault: false },
  { label: 'GST 12%', rate: 1200, isDefault: false },
  { label: 'GST 18%', rate: 1800, isDefault: false },
  { label: 'Standard - Two-wheelers (28%)', rate: 2800, isDefault: true },
];

@Injectable()
export class GstSlabsService {
  constructor(private readonly prisma: PrismaService) {}

  async seedStandardSlabsIfEmpty() {
    const count = await this.prisma.gstSlab.count();
    if (count > 0) return;
    await this.prisma.gstSlab.createMany({ data: STANDARD_SLABS });
  }

  list() {
    return this.prisma.gstSlab.findMany({ orderBy: { rate: 'asc' } });
  }

  async create(input: GstSlabInput) {
    if (input.isDefault) {
      await this.prisma.gstSlab.updateMany({ data: { isDefault: false }, where: {} });
    }
    return this.prisma.gstSlab.create({ data: input });
  }

  async update(id: string, input: Partial<GstSlabInput>) {
    if (input.isDefault) {
      await this.prisma.gstSlab.updateMany({ data: { isDefault: false }, where: {} });
    }
    return this.prisma.gstSlab.update({ where: { id }, data: input });
  }

  delete(id: string) {
    return this.prisma.gstSlab.delete({ where: { id } });
  }
}
