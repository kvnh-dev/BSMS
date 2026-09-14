import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Points at a fully separate Postgres database (bsms_test), not just a
// different schema name — the Prisma schema hardcodes `@@schema("bsms")` on
// every model, so schema-name isolation alone wouldn't separate this from
// dev data. See TECH_STACK.md "Local dev setup" for the dev database.
const TEST_DATABASE_URL = 'postgresql://garuda:garuda_dev_only@localhost:5433/bsms_test?schema=bsms';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: false, // shared test DB — files must not race each other
    globalSetup: ['./test/global-setup.ts'],
    testTimeout: 15000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    },
  },
});
