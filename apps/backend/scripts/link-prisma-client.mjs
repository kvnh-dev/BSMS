// Prisma's own CLI resolves @prisma/client relative to prisma/schema.prisma's
// directory without walking up through npm workspace hoisting the way Node's
// module resolution does, so `prisma generate`/`migrate` fail to find it when
// npm hoists @prisma/client to the monorepo root. This makes a local symlink
// in this package's own node_modules pointing at wherever it actually got
// installed, so it's self-healing across fresh installs on any machine.
import { existsSync, mkdirSync, symlinkSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, '..');
const localTarget = join(backendRoot, 'node_modules', '@prisma', 'client');

if (existsSync(localTarget)) {
  process.exit(0);
}

const require = createRequire(pathToFileURL(join(backendRoot, 'package.json')));
let resolvedEntry;
try {
  resolvedEntry = require.resolve('@prisma/client');
} catch (err) {
  console.warn('[link-prisma-client] Could not resolve @prisma/client anywhere:', err.message);
  process.exit(0);
}

const pkgDir = dirname(resolvedEntry);
mkdirSync(dirname(localTarget), { recursive: true });
symlinkSync(pkgDir, localTarget, 'dir');
console.log(`[link-prisma-client] Linked ${localTarget} -> ${realpathSync(pkgDir)}`);
