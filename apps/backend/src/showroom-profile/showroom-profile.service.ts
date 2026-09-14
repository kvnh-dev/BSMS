import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { SetupWizardInput, ShowroomProfileInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { GstSlabsService } from '../gst-slabs/gst-slabs.service.js';

@Injectable()
export class ShowroomProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly gstSlabs: GstSlabsService,
  ) {}

  async get() {
    return this.prisma.showroomProfile.findFirst();
  }

  async isSetupComplete(): Promise<boolean> {
    const profile = await this.get();
    return profile !== null;
  }

  // First-run setup wizard (plan §3): creates the single ShowroomProfile row,
  // seeds standard GST slabs, and creates the Owner's own login — all in one
  // step since none of it can exist independently on a fresh install.
  async runSetupWizard(input: SetupWizardInput) {
    const existing = await this.get();
    if (existing) {
      throw new ConflictException('Setup has already been completed');
    }

    await this.gstSlabs.seedStandardSlabsIfEmpty();
    if (input.defaultGstSlabId) {
      await this.gstSlabs.update(input.defaultGstSlabId, { isDefault: true });
    }

    const profile = await this.prisma.showroomProfile.create({
      data: { ...input.profile, invoiceSeq: 0 },
    });

    const owner = await this.users.create({
      name: input.owner.name,
      phone: input.owner.phone,
      password: input.owner.password,
      personas: ['OWNER'],
    });

    return { profile, owner };
  }

  async update(input: Partial<ShowroomProfileInput>) {
    const existing = await this.get();
    if (!existing) throw new NotFoundException('Showroom profile has not been set up yet');
    return this.prisma.showroomProfile.update({ where: { id: existing.id }, data: input });
  }
}
