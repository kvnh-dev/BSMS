import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

// Validates request bodies against the shared Zod schemas from @bsms/shared
// (packages/shared), so validation logic isn't duplicated between the
// NestJS DTOs and the Next.js forms — see WEB_APP_PLAN.md §3.
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    return result.data;
  }
}
