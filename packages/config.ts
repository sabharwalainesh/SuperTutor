import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const repoRoot = fileURLToPath(new URL('../', import.meta.url));
// Explicit paths work regardless of the caller's current working directory.
config({ path: resolve(repoRoot, '.env') });
config({ path: resolve(repoRoot, 'apps/api/.env') });
export const stateFile = resolve(repoRoot, process.env.TUTOR_STATE_FILE ?? '.data/tutor-state.json');
