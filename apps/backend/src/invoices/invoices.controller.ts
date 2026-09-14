import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import {
  createInvoiceSchema,
  editInvoiceLineItemsSchema,
  type CreateInvoiceInput,
  type EditInvoiceLineItemsInput,
} from '@bsms/shared';
import { InvoicesService } from './invoices.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list() {
    return this.invoices.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.invoices.get(id);
  }

  // Creates a DRAFT — "Generate invoice": Owner + Cashier per the RBAC
  // matrix (plan §5).
  @RequirePersonas('OWNER', 'CASHIER')
  @Post()
  create(
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoices.create(req.user!.sub, body);
  }

  // Edits a still-DRAFT standalone-sale invoice — same personas as creating one.
  @RequirePersonas('OWNER', 'CASHIER')
  @Patch(':id/draft')
  updateDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(editInvoiceLineItemsSchema)) body: EditInvoiceLineItemsInput,
  ) {
    return this.invoices.updateDraft(id, body);
  }

  // Turns a DRAFT into a real, numbered, issued invoice.
  @RequirePersonas('OWNER', 'CASHIER')
  @Post(':id/finalize')
  finalize(@Param('id') id: string) {
    return this.invoices.finalize(id);
  }

  // Owner-only correction to an already-final invoice — no @RequirePersonas
  // here since the check is Owner-specific rather than the usual
  // Owner-or-Cashier pattern; enforced inside the service (ForbiddenException).
  @Patch(':id/revise')
  revise(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(editInvoiceLineItemsSchema)) body: EditInvoiceLineItemsInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoices.revise(id, req.user!.sub, req.user!.personas, body);
  }
}
