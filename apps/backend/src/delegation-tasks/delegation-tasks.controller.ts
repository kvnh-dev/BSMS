import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { delegationTaskSchema, delegationReviewSchema, type DelegationTaskInput, type DelegationReviewInput } from '@bsms/shared';
import { DelegationTasksService } from './delegation-tasks.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('delegation-tasks')
export class DelegationTasksController {
  constructor(private readonly tasks: DelegationTasksService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    const isOwner = req.user!.personas.includes('OWNER');
    return this.tasks.listForUser(req.user!.sub, isOwner);
  }

  // Owner delegates a task to a worker — per your direction (2026-09-12),
  // creation is owner-only, not a worker-initiated request.
  @RequirePersonas('OWNER')
  @Post()
  create(@Body(new ZodValidationPipe(delegationTaskSchema)) body: DelegationTaskInput) {
    return this.tasks.create(body);
  }

  // "Approve delegated tasks": Owner-only per the RBAC matrix (plan §5).
  @RequirePersonas('OWNER')
  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(delegationReviewSchema)) body: DelegationReviewInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasks.review(id, req.user!.sub, body.status);
  }
}
