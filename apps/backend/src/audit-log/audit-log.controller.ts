import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

@RequirePersonas('OWNER', 'AUDITOR')
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  list(@Query('entity') entity?: string, @Query('entityId') entityId?: string) {
    return this.auditLog.list(entity, entityId);
  }
}
