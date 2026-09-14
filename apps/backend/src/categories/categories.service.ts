import { Injectable } from '@nestjs/common';
import type { CategoryInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  create(input: CategoryInput) {
    return this.prisma.category.create({ data: input });
  }

  update(id: string, input: Partial<CategoryInput>) {
    return this.prisma.category.update({ where: { id }, data: input });
  }

  delete(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }
}
