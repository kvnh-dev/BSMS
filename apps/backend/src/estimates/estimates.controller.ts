import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { createEstimateSchema, type CreateEstimateInput } from '@bsms/shared';
import { EstimatesService } from './estimates.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('service-tickets/:ticketId/estimate')
export class EstimatesController {
  constructor(private readonly estimates: EstimatesService) {}

  @Get()
  get(@Param('ticketId') ticketId: string) {
    return this.estimates.get(ticketId);
  }

  // "Create estimate": Owner + Technician per the RBAC matrix (plan §5).
  @RequirePersonas('OWNER', 'TECHNICIAN')
  @Put()
  createOrReplace(
    @Param('ticketId') ticketId: string,
    @Body(new ZodValidationPipe(createEstimateSchema)) body: CreateEstimateInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.estimates.createOrReplace(ticketId, req.user!.sub, body);
  }
}
