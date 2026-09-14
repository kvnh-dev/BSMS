import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { customerSchema, type CustomerInput } from '@bsms/shared';
import { CustomersService } from './customers.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list() {
    return this.customers.list();
  }

  // Registered before ':id' — otherwise Nest would route "search" as an id
  // param (same reasoning as bikes.controller.ts's 'search' route).
  @Get('search')
  search(@Query('q') query: string) {
    return this.customers.search(query ?? '');
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.customers.get(id);
  }

  // Intake can be done by Owner, Technician (walk-in service), or Cashier
  // (standalone sale) — matches who realistically starts a customer record.
  @RequirePersonas('OWNER', 'TECHNICIAN', 'CASHIER')
  @Post()
  create(@Body(new ZodValidationPipe(customerSchema)) body: CustomerInput) {
    return this.customers.create(body);
  }

  @RequirePersonas('OWNER', 'TECHNICIAN', 'CASHIER')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(customerSchema.partial())) body: Partial<CustomerInput>,
  ) {
    return this.customers.update(id, body);
  }
}
