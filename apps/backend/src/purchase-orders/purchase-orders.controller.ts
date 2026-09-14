import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { purchaseOrderSchema, type PurchaseOrderInput } from '@bsms/shared';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  list() {
    return this.purchaseOrders.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.purchaseOrders.get(id);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Post()
  create(
    @Body(new ZodValidationPipe(purchaseOrderSchema)) body: PurchaseOrderInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.purchaseOrders.create(req.user!.sub, body);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(purchaseOrderSchema)) body: PurchaseOrderInput) {
    return this.purchaseOrders.update(id, body);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.purchaseOrders.cancel(id);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Post(':id/convert')
  convert(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.purchaseOrders.convert(id, req.user!.sub);
  }
}
