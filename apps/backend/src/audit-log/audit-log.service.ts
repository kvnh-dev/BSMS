import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  // entity/entityId narrow this to one record's history — e.g. an
  // InventoryItem detail page showing just its own stock adjustments,
  // rather than the whole showroom's audit trail.
  list(entity?: string, entityId?: string) {
    return this.prisma.auditLog.findMany({
      where: { ...(entity ? { entity } : {}), ...(entityId ? { entityId } : {}) },
      include: { actor: { select: { name: true } } },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }
}
