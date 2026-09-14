import { Module } from '@nestjs/common';
import { ShowroomProfileService } from './showroom-profile.service.js';
import { ShowroomProfileController } from './showroom-profile.controller.js';
import { UsersModule } from '../users/users.module.js';
import { GstSlabsModule } from '../gst-slabs/gst-slabs.module.js';

@Module({
  imports: [UsersModule, GstSlabsModule],
  controllers: [ShowroomProfileController],
  providers: [ShowroomProfileService],
})
export class ShowroomProfileModule {}
