import { Controller, Get, Post, Query, Req } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { RequirePersonas } from '../auth/personas.decorator.js';
import type { AuthenticatedRequest } from '../auth/types.js';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('check-in')
  checkIn(@Req() req: AuthenticatedRequest) {
    return this.attendance.checkIn(req.user!.sub);
  }

  @Post('check-out')
  checkOut(@Req() req: AuthenticatedRequest) {
    return this.attendance.checkOut(req.user!.sub);
  }

  @Get('me')
  ownHistory(@Req() req: AuthenticatedRequest) {
    return this.attendance.ownHistory(req.user!.sub);
  }

  @RequirePersonas('OWNER')
  @Get()
  allStaffHistory(@Query('month') month?: string, @Query('userId') userId?: string) {
    return this.attendance.allStaffHistory(month, userId);
  }
}
