// Minimal forward-only SQL migration runner.
//
// Applies any *.sql files in server/migrations/ that have not run yet, tracked in
// a `schema_migrations` table. Files run in filename order, each in its own
// transaction, so a failure rolls back cleanly and stops the run.
//
// Usage: npm run migrate   (from the server/ directory)
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pool from './db.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

const run = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.filename));

  let appliedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file} (already applied)`);
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`apply  ${file}`);
      appliedCount += 1;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`FAILED ${file}: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  console.log(appliedCount === 0 ? 'No new migrations to apply.' : `Applied ${appliedCount} migration(s).`);
};

run()
  .then(() => pool.end())
  .catch(async (error) => {
    await pool.end();
    console.error(error);
    process.exit(1);
  });
