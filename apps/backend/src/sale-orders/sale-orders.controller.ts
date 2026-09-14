import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { saleOrderSchema, type SaleOrderInput } from '@bsms/shared';
import { SaleOrdersService } from './sale-orders.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('sale-orders')
export class SaleOrdersController {
  constructor(private readonly saleOrders: SaleOrdersService) {}

  @Get()
  list() {
    return this.saleOrders.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.saleOrders.get(id);
  }

  // Same personas as creating an invoice (plan §5).
  @RequirePersonas('OWNER', 'CASHIER')
  @Post()
  create(
    @Body(new ZodValidationPipe(saleOrderSchema)) body: SaleOrderInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.saleOrders.create(req.user!.sub, body);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(saleOrderSchema)) body: SaleOrderInput) {
    return this.saleOrders.update(id, body);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.saleOrders.cancel(id);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Post(':id/convert')
  convert(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.saleOrders.convert(id, req.user!.sub);
  }
}
