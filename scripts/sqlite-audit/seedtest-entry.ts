import { SCHEMA_DDL } from '../../src/db/schema.ts';
import { buildSeedStatements } from '../../src/db/seed.ts';
import { buildEnterpriseSeedStatements } from '../../src/enterprise/seed.ts';

const out = JSON.stringify({ ddl: SCHEMA_DDL, seed: [...buildSeedStatements(), ...buildEnterpriseSeedStatements()] });
console.log(out);
