import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { createPurchaseBillSchema, type CreatePurchaseBillInput } from '@bsms/shared';
import { PurchaseBillsService } from './purchase-bills.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('purchase-bills')
export class PurchaseBillsController {
  constructor(private readonly purchaseBills: PurchaseBillsService) {}

  @Get()
  list() {
    return this.purchaseBills.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.purchaseBills.get(id);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Post()
  create(
    @Body(new ZodValidationPipe(createPurchaseBillSchema)) body: CreatePurchaseBillInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.purchaseBills.create(req.user!.sub, body);
  }
}
