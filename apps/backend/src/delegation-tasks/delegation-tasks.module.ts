import { Module } from '@nestjs/common';
import { DelegationTasksService } from './delegation-tasks.service.js';
import { DelegationTasksController } from './delegation-tasks.controller.js';

@Module({
  controllers: [DelegationTasksController],
  providers: [DelegationTasksService],
})
export class DelegationTasksModule {}
