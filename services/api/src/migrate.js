// Applies migrations/*.sql in name order, once each (tracked in schema_migrations).
// Run before the first start and after every pull: `npm run migrate`.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
await client.query(
  'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
);
const { rows } = await client.query('SELECT name FROM schema_migrations');
const applied = new Set(rows.map((r) => r.name));

for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
  if (applied.has(file)) continue;
  const sql = await fs.readFile(path.join(dir, file), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`[migrate] applied ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[migrate] ${file} failed: ${err.message}`);
    process.exit(1);
  }
}
await client.end();
