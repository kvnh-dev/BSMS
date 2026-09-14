import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { recordPaymentSchema, voidPaymentSchema, type RecordPaymentInput, type VoidPaymentInput } from '@bsms/shared';
import { SupplierPaymentsService } from './supplier-payments.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('purchase-bills/:purchaseBillId/payments')
export class PurchaseBillPaymentsController {
  constructor(private readonly payments: SupplierPaymentsService) {}

  @Get()
  list(@Param('purchaseBillId') purchaseBillId: string) {
    return this.payments.list(purchaseBillId);
  }

  @RequirePersonas('OWNER', 'CASHIER')
  @Post()
  record(
    @Param('purchaseBillId') purchaseBillId: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: RecordPaymentInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payments.record(purchaseBillId, req.user!.sub, body);
  }
}

@Controller('supplier-payments')
export class SupplierPaymentsController {
  constructor(private readonly payments: SupplierPaymentsService) {}

  @Patch(':id/void')
  void(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(voidPaymentSchema)) body: VoidPaymentInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payments.void(id, req.user!.sub, req.user!.personas, body.reason);
  }
}
