import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DataExportService } from './data-export.service.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

@RequirePersonas('OWNER')
@Controller('data-export')
export class DataExportController {
  constructor(private readonly dataExport: DataExportService) {}

  @Get('all')
  async all(@Res({ passthrough: true }) res: Response) {
    const data = await this.dataExport.all();
    const filename = `bsms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return data;
  }
}
