import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { recordPaymentSchema, voidPaymentSchema, type RecordPaymentInput, type VoidPaymentInput } from '@bsms/shared';
import { PaymentsService } from './payments.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('invoices/:invoiceId/payments')
export class InvoicePaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Param('invoiceId') invoiceId: string) {
    return this.payments.list(invoiceId);
  }

  // "Record payment": Owner + Cashier — same personas as who creates/finalizes invoices.
  @RequirePersonas('OWNER', 'CASHIER')
  @Post()
  record(
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: RecordPaymentInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payments.record(invoiceId, req.user!.sub, body);
  }
}

// Separate top-level path since a payment is voided by its own id, not
// scoped under a particular invoice — mirrors why Invoice.revise() isn't
// nested any deeper than /invoices/:id either.
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // Owner-only correction — no @RequirePersonas here since the check is
  // Owner-specific rather than the usual Owner-or-Cashier pattern; enforced
  // inside the service (ForbiddenException), same as InvoicesController.revise().
  @Patch(':id/void')
  void(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(voidPaymentSchema)) body: VoidPaymentInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payments.void(id, req.user!.sub, req.user!.personas, body.reason);
  }
}
