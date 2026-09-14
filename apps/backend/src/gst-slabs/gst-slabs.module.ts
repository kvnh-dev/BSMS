import { Module } from '@nestjs/common';
import { GstSlabsService } from './gst-slabs.service.js';
import { GstSlabsController } from './gst-slabs.controller.js';

@Module({
  controllers: [GstSlabsController],
  providers: [GstSlabsService],
  exports: [GstSlabsService],
})
export class GstSlabsModule {}
