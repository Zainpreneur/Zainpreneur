/**
 * Drop the database file and rebuild it.
 *
 *   npm run db:reset           empty schema, no data
 *   npm run db:reset -- --seed  schema plus the demo seed
 *
 * The file is removed rather than emptied: `DROP TABLE` inside a live connection
 * leaves the WAL and the free list behind, and a fresh file has no inherited state
 * to explain.
 */
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { closeDb, dbPath } from "../db/client.js";

// The same resolution the app uses — see the note in client.ts. Resetting a
// different file than the one the API reads is how the register looks empty.
const file = resolve(dbPath());
closeDb();

for (const suffix of ["", "-wal", "-shm"]) {
  const path = `${file}${suffix}`;
  if (existsSync(path)) {
    rmSync(path);
    console.log(`removed ${path}`);
  }
}

console.log("database reset — run `npm run db:seed` to add the demo data");