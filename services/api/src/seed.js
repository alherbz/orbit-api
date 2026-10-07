// Demo data for an empty database: `npm run seed` (after `npm run migrate`).
// Does nothing when tasks already exist.
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM tasks');
if (rows[0].n > 0) {
  console.log('[seed] tasks already present — skipped');
} else {
  await client.query(
    `INSERT INTO tasks (title, owner, priority, done) VALUES
       ('Ship the YC demo', 'unassigned', 'high', false),
       ('Import the repositories', 'unassigned', 'medium', true),
       ('Write the onboarding email', 'unassigned', 'low', false)`,
  );
  await client.query(
    `INSERT INTO activity (task_id, kind, message)
     SELECT id, 'seeded', 'Created by the seed script' FROM tasks`,
  );
  console.log('[seed] 3 tasks inserted');
}
await client.end();
