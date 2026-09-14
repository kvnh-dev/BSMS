import { Module } from '@nestjs/common';
import { ServiceTicketsService } from './service-tickets.service.js';
import { ServiceTicketsController } from './service-tickets.controller.js';

@Module({
  controllers: [ServiceTicketsController],
  providers: [ServiceTicketsService],
  exports: [ServiceTicketsService],
})
export class ServiceTicketsModule {}
