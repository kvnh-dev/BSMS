import { Module } from '@nestjs/common';
import { DataExportService } from './data-export.service.js';
import { DataExportController } from './data-export.controller.js';

@Module({
  controllers: [DataExportController],
  providers: [DataExportService],
})
export class DataExportModule {}
