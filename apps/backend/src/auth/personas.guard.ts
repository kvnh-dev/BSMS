import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Persona } from '@bsms/shared';
import { PERSONAS_KEY } from './personas.decorator.js';
import type { AuthenticatedRequest } from './types.js';

@Injectable()
export class PersonasGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Persona[] | undefined>(PERSONAS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userPersonas = request.user?.personas ?? [];
    const allowed = required.some((p) => userPersonas.includes(p));
    if (!allowed) {
      throw new ForbiddenException(`Requires one of: ${required.join(', ')}`);
    }
    return true;
  }
}
