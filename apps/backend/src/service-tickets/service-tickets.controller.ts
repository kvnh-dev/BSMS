import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  serviceTicketIntakeSchema,
  serviceTicketStatusUpdateSchema,
  servicePartUsedSchema,
  serviceChargeSchema,
  type ServiceChargeInput,
  type ServicePartUsedInput,
  type ServiceTicketIntakeInput,
  type ServiceTicketStatusUpdateInput,
} from '@bsms/shared';
import { ServiceTicketsService } from './service-tickets.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('service-tickets')
export class ServiceTicketsController {
  constructor(private readonly tickets: ServiceTicketsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('technicianId') technicianId?: string) {
    return this.tickets.list(status, technicianId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tickets.get(id);
  }

  @RequirePersonas('OWNER', 'TECHNICIAN')
  @Post()
  create(
    @Body(new ZodValidationPipe(serviceTicketIntakeSchema)) body: ServiceTicketIntakeInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tickets.create(body, req.user!.sub, req.user!.personas);
  }

  // No @RequirePersonas here — allowed personas depend on the *target*
  // status, checked inside the service (see STATUS_TRANSITION_PERSONAS).
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(serviceTicketStatusUpdateSchema)) body: ServiceTicketStatusUpdateInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tickets.updateStatus(id, body.status, req.user!.sub, req.user!.personas);
  }

  @RequirePersonas('OWNER', 'TECHNICIAN')
  @Post(':id/parts')
  addPartUsed(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(servicePartUsedSchema)) body: ServicePartUsedInput,
  ) {
    return this.tickets.addPartUsed(id, body);
  }

  @RequirePersonas('OWNER', 'TECHNICIAN')
  @Post(':id/charges')
  addServiceCharge(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(serviceChargeSchema)) body: ServiceChargeInput,
  ) {
    return this.tickets.addServiceCharge(id, body);
  }
}
