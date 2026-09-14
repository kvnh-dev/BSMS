import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { BikeInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BikesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(id: string) {
    const bike = await this.prisma.bike.findUnique({
      where: { id },
      include: { customer: true, serviceTickets: { orderBy: { createdAt: 'desc' } } },
    });
    if (!bike) throw new NotFoundException('Bike not found');
    return bike;
  }

  async create(input: BikeInput) {
    const existing = await this.prisma.bike.findFirst({
      where: { OR: [{ regNo: input.regNo }, { chassisNo: input.chassisNo }] },
    });
    if (existing) {
      throw new ConflictException('A bike with this registration or chassis number already exists');
    }
    return this.prisma.bike.create({ data: input });
  }

  // Front-desk searches by reg number or the customer's phone — matches the
  // real intake journey ("customer visited, worker searched the bike by
  // phone/reg num"), not just the bike's own identifiers.
  search(query: string) {
    return this.prisma.bike.findMany({
      where: {
        OR: [
          { regNo: { contains: query, mode: 'insensitive' } },
          { chassisNo: { contains: query, mode: 'insensitive' } },
          { customer: { phone: { contains: query, mode: 'insensitive' } } },
        ],
      },
      include: { customer: true },
      take: 20,
    });
  }
}
