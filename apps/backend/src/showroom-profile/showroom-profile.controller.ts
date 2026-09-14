import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { setupWizardSchema, showroomProfileSchema, type SetupWizardInput, type ShowroomProfileInput } from '@bsms/shared';
import { ShowroomProfileService } from './showroom-profile.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { Public } from '../auth/public.decorator.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

@Controller('showroom-profile')
export class ShowroomProfileController {
  constructor(private readonly profile: ShowroomProfileService) {}

  // Public: the frontend needs this before a user can log in, to decide
  // whether to route to /setup or /login (see WEB_APP_PLAN.md §1).
  @Public()
  @Get('setup-status')
  async setupStatus() {
    return { isSetupComplete: await this.profile.isSetupComplete() };
  }

  @Public()
  @Post('setup')
  runSetupWizard(@Body(new ZodValidationPipe(setupWizardSchema)) body: SetupWizardInput) {
    return this.profile.runSetupWizard(body);
  }

  @Get()
  get() {
    return this.profile.get();
  }

  @RequirePersonas('OWNER')
  @Patch()
  update(@Body(new ZodValidationPipe(showroomProfileSchema.partial())) body: Partial<ShowroomProfileInput>) {
    return this.profile.update(body);
  }
}
