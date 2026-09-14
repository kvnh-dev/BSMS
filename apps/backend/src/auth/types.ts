import type { Request } from 'express';
import type { Persona } from '@bsms/shared';

export interface JwtPayload {
  sub: string; // user id
  phone: string;
  personas: Persona[];
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
