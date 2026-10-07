// Consumes the `task-events` queue the API fills and writes the activity feed.
// Needs the same Postgres (already migrated by the API's `npm run migrate`) and Redis.
import pg from 'pg';
import { Redis } from 'ioredis';
import { Worker } from 'bullmq';

for (const name of ['DATABASE_URL', 'REDIS_URL']) {
  if (!process.env[name]) {
    console.error(`[worker] ${name} is required`);
    process.exit(1);
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const MESSAGES = {
  'task.created': (t) => `Task "${t.title}" created`,
  'task.completed': (t) => `Task "${t.title}" completed`,
  'task.reopened': (t) => `Task "${t.title}" reopened`,
  'attachment.added': (t) => `File attached to "${t.title}"`,
};

const worker = new Worker(
  'task-events',
  async (job) => {
    const message = (MESSAGES[job.name] ?? ((t) => `${job.name}: ${t.title}`))(job.data);
    await pool.query('INSERT INTO activity (task_id, kind, message) VALUES ($1,$2,$3)', [
      job.data.taskId,
      job.name,
      message,
    ]);
  },
  { connection },
);

worker.on('ready', () => console.log('[worker] listening on task-events'));
worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed: ${err.message}`));
