import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { bikeSchema, type BikeInput } from '@bsms/shared';
import { BikesService } from './bikes.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

@Controller('bikes')
export class BikesController {
  constructor(private readonly bikes: BikesService) {}

  // Global service-log search "any bike" — Owner/Technician full, others
  // view-only per RBAC matrix; enforced by not exposing mutation routes to them.
  @Get('search')
  search(@Query('q') query: string) {
    return this.bikes.search(query ?? '');
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.bikes.get(id);
  }

  @RequirePersonas('OWNER', 'TECHNICIAN', 'CASHIER')
  @Post()
  create(@Body(new ZodValidationPipe(bikeSchema)) body: BikeInput) {
    return this.bikes.create(body);
  }
}
