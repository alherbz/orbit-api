import Fastify from 'fastify';
import pg from 'pg';

const PORT = Number(process.env.PORT || 8083);
const DATABASE_URL = process.env.DATABASE_URL;

const app = Fastify({ logger: true });

// The API prefers Postgres (wired from the `db` node in preview) but stays
// runnable without it, so the app never hard-fails when DATABASE_URL is absent.
let pool = null;
const memory = [
  { id: 1, title: 'Ship the YC demo', priority: 'high', done: false },
  { id: 2, title: 'Import repos into Infrar', priority: 'medium', done: true },
];
let nextId = 3;

async function initDb() {
  if (!DATABASE_URL) {
    app.log.warn('DATABASE_URL not set — falling back to in-memory store');
    return;
  }
  pool = new pg.Pool({ connectionString: DATABASE_URL });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id       SERIAL PRIMARY KEY,
      title    TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      done     BOOLEAN NOT NULL DEFAULT false
    );
  `);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM tasks');
  if (rows[0].n === 0) {
    await pool.query(
      'INSERT INTO tasks (title, priority, done) VALUES ($1,$2,$3),($4,$5,$6)',
      ['Ship the YC demo', 'high', false, 'Import repos into Infrar', 'medium', true],
    );
  }
}

app.get('/health', async () => ({ status: 'ok' }));

app.get('/tasks', async () => {
  if (pool) {
    const { rows } = await pool.query(
      'SELECT id, title, priority, done FROM tasks ORDER BY id',
    );
    return rows;
  }
  return memory;
});

app.post('/tasks', async (req, reply) => {
  const { title, priority = 'medium' } = req.body ?? {};
  if (!title) {
    reply.code(400);
    return { error: 'title is required' };
  }
  if (pool) {
    const { rows } = await pool.query(
      'INSERT INTO tasks (title, priority) VALUES ($1,$2) RETURNING id, title, priority, done',
      [title, priority],
    );
    reply.code(201);
    return rows[0];
  }
  const task = { id: nextId++, title, priority, done: false };
  memory.push(task);
  reply.code(201);
  return task;
});

const start = async () => {
  try {
    await initDb();
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
