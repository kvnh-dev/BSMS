import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { supplierSchema, type SupplierInput } from '@bsms/shared';
import { SuppliersService } from './suppliers.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list() {
    return this.suppliers.list();
  }

  // Registered before ':id' — see customers.controller.ts's same reasoning.
  @Get('search')
  search(@Query('q') query: string) {
    return this.suppliers.search(query ?? '');
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.suppliers.get(id);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Post()
  create(@Body(new ZodValidationPipe(supplierSchema)) body: SupplierInput) {
    return this.suppliers.create(body);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(supplierSchema.partial())) body: Partial<SupplierInput>,
  ) {
    return this.suppliers.update(id, body);
  }
}
