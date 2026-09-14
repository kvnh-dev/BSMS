import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DelegationTaskInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DelegationTasksService {
  constructor(private readonly prisma: PrismaService) {}

  // Owner sees the full queue (to approve/reject); everyone else sees only
  // their own requests — matches the "owner-review workflow" from plan §4.
  listForUser(userId: string, isOwner: boolean) {
    return this.prisma.delegationTask.findMany({
      where: isOwner ? undefined : { assignedToId: userId },
      include: { assignedTo: true, reviewedBy: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: DelegationTaskInput) {
    return this.prisma.delegationTask.create({
      data: {
        assignedToId: input.assignedToId,
        taskType: input.taskType,
        payload: input.payload as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async review(id: string, reviewerId: string, status: 'APPROVED' | 'REJECTED') {
    const task = await this.prisma.delegationTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Delegation task not found');
    if (task.status !== 'PENDING') {
      throw new BadRequestException('This task has already been reviewed');
    }
    return this.prisma.delegationTask.update({
      where: { id },
      data: { status, reviewedById: reviewerId, reviewedAt: new Date() },
    });
  }
}
