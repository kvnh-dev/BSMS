import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Opts a route out of the global JwtAuthGuard — used for login/refresh and
// the first-run setup wizard (no user/session exists yet to authenticate).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
