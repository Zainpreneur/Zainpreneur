import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const DIST = path.join(DIR, 'dist');
export const SEED_JSON = path.join(DIST, 'seed.json');
export const MIGRATE_JSON = path.join(DIST, 'migrate.json');
export const NODE_WASM = path.join(DIR, '..', '..', 'node_modules', '@sqlite.org', 'sqlite-wasm', 'dist', 'node.mjs');
