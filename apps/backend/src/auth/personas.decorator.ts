import { SetMetadata } from '@nestjs/common';
import type { Persona } from '@bsms/shared';

export const PERSONAS_KEY = 'personas';

// Route-level RBAC enforcement — the actual authority, not just the frontend
// nav hiding (see WEB_APP_PLAN.md §2's RoleGate note). Matches the matrix in
// bike-showroom-implementation-plan.pdf §5.
export const RequirePersonas = (...personas: Persona[]) => SetMetadata(PERSONAS_KEY, personas);
