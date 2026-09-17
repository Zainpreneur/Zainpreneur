/**
 * Repeatable SQLite audit: bundles the worker + app surface, generates seed
 * fixtures from live repo sources, and runs the SQL, migration and
 * end-to-end suites. Usage: `npm run audit:sqlite`.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(DIR, 'dist');
const ROOT = path.join(DIR, '..', '..');
const WASM_SRC = path.join(ROOT, 'node_modules', '@sqlite.org', 'sqlite-wasm', 'dist', 'node.mjs');
const WASM_BIN = path.join(ROOT, 'node_modules', '@sqlite.org', 'sqlite-wasm', 'dist', 'sqlite3.wasm');
const step = (label, fn) => {
  console.log(`\n### ${label}`);
  fn();
};

const q = (value) => `"${value}"`;

const esbuild = (entry, outfile, extra = []) => {
  // shell:true so npx.cmd resolves on Windows; quote every path (spaces).
  execFileSync(
    'npx',
    ['-y', 'esbuild', q(entry), '--bundle', '--format=esm', '--platform=node', `--outfile=${q(outfile)}`, '--log-level=error', `--alias:@sqlite.org/sqlite-wasm=${q(WASM_SRC)}`, ...extra.map((arg) => (arg.startsWith('--inject:') ? `--inject:${q(arg.slice('--inject:'.length))}` : arg))],
    { stdio: 'inherit', cwd: ROOT, shell: true },
  );
};

const runNode = (file, outFile) => {
  const out = execFileSync(process.execPath, [file], { cwd: DIST, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (outFile) writeFileSync(outFile, out.replace(/^\uFEFF/, ''), 'utf8');
  else process.stdout.write(out);
};

let failed = false;
const runSuite = (file) => {
  try {
    execFileSync(process.execPath, [file], { cwd: DIST, stdio: 'inherit' });
  } catch {
    failed = true;
  }
};

try {
  mkdirSync(DIST, { recursive: true });

  step('bundle worker + app surface', () => {
    esbuild(path.join(DIR, 'worker-entry.ts'), path.join(DIST, 'sqlite.worker.ts'), [`--inject:${path.join(DIR, 'shim-self.ts')}`]);
    esbuild(path.join(DIR, 'app-entry.ts'), path.join(DIST, 'app.mjs'));
    copyFileSync(WASM_BIN, path.join(DIST, 'sqlite3.wasm'));
  });

  step('generate fixtures from live sources', () => {
    esbuild(path.join(DIR, 'seedtest-entry.ts'), path.join(DIST, 'seedgen.mjs'));
    esbuild(path.join(DIR, 'migratetest-entry.ts'), path.join(DIST, 'migrategen.mjs'));
    runNode(path.join(DIST, 'seedgen.mjs'), path.join(DIST, 'seed.json'));
    runNode(path.join(DIST, 'migrategen.mjs'), path.join(DIST, 'migrate.json'));
  });

  step('SQL suite (schema + seed + enterprise flows)', () => runSuite(path.join(DIR, 'sqltest.mjs')));
  step('migration suite (v3 planner + rebuild)', () => runSuite(path.join(DIR, 'migratetest.mjs')));
  step('end-to-end suite (worker + repositories + services)', () => runSuite(path.join(DIR, 'run.mjs')));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  failed = true;
}

console.log(failed ? '\nAUDIT: FAILURES PRESENT' : '\nAUDIT: ALL SUITES GREEN');
process.exit(failed ? 1 : 0);
