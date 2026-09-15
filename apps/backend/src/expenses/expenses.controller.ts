import { Body, Controller, Get, Post } from '@nestjs/common';
import { expenseSchema, type ExpenseInput } from '@bsms/shared';
import { ExpensesService } from './expenses.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @RequirePersonas('OWNER', 'AUDITOR')
  @Get()
  list() {
    return this.expenses.list();
  }

  // Owner-only — the one place a human posts directly to the ledger.
  @RequirePersonas('OWNER')
  @Post()
  create(@Body(new ZodValidationPipe(expenseSchema)) body: ExpenseInput) {
    return this.expenses.create(body);
  }
}
