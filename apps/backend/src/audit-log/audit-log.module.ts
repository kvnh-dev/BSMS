import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service.js';
import { AuditLogController } from './audit-log.controller.js';

@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
})
export class AuditLogModule {}
