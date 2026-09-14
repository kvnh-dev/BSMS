import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { gstSlabSchema, type GstSlabInput } from '@bsms/shared';
import { GstSlabsService } from './gst-slabs.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

@Controller('gst-slabs')
export class GstSlabsController {
  constructor(private readonly gstSlabs: GstSlabsService) {}

  @Get()
  list() {
    return this.gstSlabs.list();
  }

  // "Configure GST rates" is Owner-only per the RBAC matrix (plan §5).
  @RequirePersonas('OWNER')
  @Post()
  create(@Body(new ZodValidationPipe(gstSlabSchema)) body: GstSlabInput) {
    return this.gstSlabs.create(body);
  }

  @RequirePersonas('OWNER')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(gstSlabSchema.partial())) body: Partial<GstSlabInput>,
  ) {
    return this.gstSlabs.update(id, body);
  }

  @RequirePersonas('OWNER')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.gstSlabs.delete(id);
  }
}
