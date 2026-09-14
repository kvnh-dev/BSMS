import { Module } from '@nestjs/common';
import { BikesService } from './bikes.service.js';
import { BikesController } from './bikes.controller.js';

@Module({
  controllers: [BikesController],
  providers: [BikesService],
  exports: [BikesService],
})
export class BikesModule {}
