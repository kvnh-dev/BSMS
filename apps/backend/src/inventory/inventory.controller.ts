import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  inventoryItemSchema,
  inventoryStockAdjustSchema,
  type InventoryItemInput,
  type InventoryStockAdjustInput,
} from '@bsms/shared';
import { InventoryService } from './inventory.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Viewable by any authenticated persona (Cashier/Delivery/Auditor are
  // view-only per the RBAC matrix; enforcing that is just "no mutation
  // routes exposed to them", not a separate view permission).
  @Get()
  list() {
    return this.inventory.list();
  }

  // Registered before ':id' — otherwise Nest would route "lookup"/"search" as
  // an id param (same reasoning as bikes.controller.ts's 'search' route).
  @Get('lookup')
  lookup(@Query('code') code: string) {
    return this.inventory.findByCode(code ?? '');
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.inventory.search(query ?? '');
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.inventory.get(id);
  }

  // Owner-only for now. Technician delegated access ("if delegated" in the
  // RBAC matrix) is wired up once the DelegationTask approval workflow
  // exists (Phase 3) — see MOBILE_APP_PLAN.md/WEB_APP_PLAN.md delegation queue.
  @RequirePersonas('OWNER')
  @Post()
  create(@Body(new ZodValidationPipe(inventoryItemSchema)) body: InventoryItemInput) {
    return this.inventory.create(body);
  }

  @RequirePersonas('OWNER')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(inventoryItemSchema.partial())) body: Partial<InventoryItemInput>,
  ) {
    return this.inventory.update(id, body);
  }

  @RequirePersonas('OWNER')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.inventory.delete(id);
  }

  @RequirePersonas('OWNER')
  @Post(':id/adjust-stock')
  adjustStock(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(inventoryStockAdjustSchema)) body: InventoryStockAdjustInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.inventory.adjustStock(id, req.user!.sub, body);
  }
}
