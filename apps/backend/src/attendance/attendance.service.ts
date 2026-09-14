import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Built from calendar-date components (not local-midnight-then-implicit-UTC-
// conversion) so the stored @db.Date value always matches today's actual
// calendar date regardless of the server machine's timezone offset.
function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOpenTodayRecord(userId: string) {
    return this.prisma.attendance.findFirst({
      where: { userId, date: startOfToday() },
      orderBy: { checkIn: 'desc' },
    });
  }

  async checkIn(userId: string) {
    const open = await this.findOpenTodayRecord(userId);
    if (open && !open.checkOut) {
      throw new BadRequestException('Already checked in today');
    }
    return this.prisma.attendance.create({
      data: { userId, date: startOfToday(), checkIn: new Date() },
    });
  }

  async checkOut(userId: string) {
    const open = await this.findOpenTodayRecord(userId);
    if (!open || open.checkOut) {
      throw new BadRequestException('No open check-in to check out from');
    }
    return this.prisma.attendance.update({
      where: { id: open.id },
      data: { checkOut: new Date() },
    });
  }

  ownHistory(userId: string) {
    return this.prisma.attendance.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 90,
    });
  }

  // Owner-only view (RBAC matrix: "View attendance" - Owner sees all, others own-only).
  // `month` is "YYYY-MM" — bounds the query to that calendar month, computed
  // via UTC date components (not local-midnight) to match startOfToday()'s
  // approach above and avoid the date-range boundary bug (see memory).
  // `userId` narrows this to one worker's own history — e.g. their detail
  // page showing recent attendance without the whole staff's records.
  allStaffHistory(month?: string, userId?: string) {
    let dateFilter: { gte: Date; lt: Date } | undefined;
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      dateFilter = {
        gte: new Date(Date.UTC(year, mon - 1, 1)),
        lt: new Date(Date.UTC(year, mon, 1)),
      };
    }
    return this.prisma.attendance.findMany({
      where: { ...(dateFilter ? { date: dateFilter } : {}), ...(userId ? { userId } : {}) },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
      take: 500,
    });
  }
}
