import { Module } from '@nestjs/common';
import { EstimatesService } from './estimates.service.js';
import { EstimatesController } from './estimates.controller.js';

@Module({
  controllers: [EstimatesController],
  providers: [EstimatesService],
})
export class EstimatesModule {}
