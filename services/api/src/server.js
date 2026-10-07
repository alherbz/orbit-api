import crypto from 'node:crypto';
import Fastify from 'fastify';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';
import { pool, redis, events, s3, checkDeps } from './deps.js';

const app = Fastify({ logger: true, bodyLimit: 5 * 1024 * 1024 });

// Attachments are uploaded as the raw request body (see POST /tasks/:id/attachments).
app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

// Readiness: 200 only when Postgres (migrated), Redis and the S3 bucket all answer.
// The web header's status chip shows the same three words.
async function health(_req, reply) {
  const deps = await checkDeps();
  const ok = Object.values(deps).every((v) => v === 'ok');
  reply.code(ok ? 200 : 503);
  return { status: ok ? 'ok' : 'degraded', deps };
}
app.get('/health', health);

// Avoid returning older cached task objects that lack due_date.
const TASKS_CACHE_KEY = 'orbit:tasks:v2';
const TASKS_CACHE_TTL_S = 10;

// Quiz broadcast over SSE; connections are per-process.
const quizClients = new Set();
const QUIZZES = [
  { question: 'Which planet has the most moons?', options: ['Earth', 'Mars', 'Saturn', 'Venus'], answer: 'Saturn' },
  { question: 'What does HTTP status 418 mean?', options: ['Not Found', "I'm a teapot", 'Gone', 'Too Early'], answer: "I'm a teapot" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sign(taskId) {
  const mac = crypto.createHmac('sha256', config.signingSecret).update(String(taskId)).digest('base64url');
  return `${taskId}.${mac}`;
}

function verify(token) {
  const [id, mac] = String(token).split('.');
  if (!id || !mac) return null;
  const expected = sign(id).split('.')[1];
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? Number(id) : null;
}

async function findTask(id) {
  const { rows } = await pool.query('SELECT id, title, priority, done, due_date::text AS due_date FROM tasks WHERE id = $1', [id]);
  return rows[0] ?? null;
}

async function emit(kind, task) {
  await events.add(kind, { taskId: task.id, title: task.title });
}

// Everything the frontend calls is served under /api (the web server forwards
// /api/* here without stripping the prefix).
async function apiRoutes(api) {
  api.get('/health', health);

  api.get('/tasks', async () => {
    const cached = await redis.get(TASKS_CACHE_KEY);
    if (cached) return JSON.parse(cached);
    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.priority, t.done, t.due_date::text AS due_date, COUNT(a.id)::int AS attachments
         FROM tasks t LEFT JOIN attachments a ON a.task_id = t.id
        GROUP BY t.id ORDER BY t.id`,
    );
    await redis.set(TASKS_CACHE_KEY, JSON.stringify(rows), 'EX', TASKS_CACHE_TTL_S);
    return rows;
  });

  api.post('/tasks', async (req, reply) => {
    const { title, priority = 'medium', due_date = null } = req.body ?? {};
    if (!title) {
      reply.code(400);
      return { error: 'title is required' };
    }
    if (due_date !== null) {
      const date = typeof due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(due_date)
        ? new Date(`${due_date}T00:00:00Z`)
        : null;
      if (!date || !Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 ||
          date.toISOString().slice(0, 10) !== due_date) {
        reply.code(400);
        return { error: 'due_date must be a valid date in YYYY-MM-DD format or null' };
      }
    }
    const { rows } = await pool.query(
      'INSERT INTO tasks (title, priority, due_date) VALUES ($1,$2,$3) RETURNING id, title, priority, done, due_date::text AS due_date',
      [title, priority, due_date],
    );
    await redis.del(TASKS_CACHE_KEY);
    await emit('task.created', rows[0]);
    reply.code(201);
    return rows[0];
  });

  api.patch('/tasks/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const { done } = req.body ?? {};
    if (!Number.isInteger(id) || typeof done !== 'boolean') {
      reply.code(400);
      return { error: 'an integer id and a boolean "done" are required' };
    }
    const { rows } = await pool.query(
      'UPDATE tasks SET done = $2 WHERE id = $1 RETURNING id, title, priority, done, due_date::text AS due_date',
      [id, done],
    );
    if (!rows[0]) {
      reply.code(404);
      return { error: `task ${id} not found` };
    }
    await redis.del(TASKS_CACHE_KEY);
    await emit(done ? 'task.completed' : 'task.reopened', rows[0]);
    return rows[0];
  });

  api.get('/activity', async () => {
    const { rows } = await pool.query(
      'SELECT id, task_id, kind, message, created_at FROM activity ORDER BY id DESC LIMIT 20',
    );
    return rows;
  });

  api.get('/tasks/:id/attachments', async (req) => {
    const { rows } = await pool.query(
      'SELECT id, filename, content_type, size, created_at FROM attachments WHERE task_id = $1 ORDER BY id',
      [Number(req.params.id)],
    );
    return rows;
  });

  // Raw body upload: Content-Type is the file's, ?filename= names it.
  api.post('/tasks/:id/attachments', async (req, reply) => {
    const task = await findTask(Number(req.params.id));
    if (!task) {
      reply.code(404);
      return { error: `task ${req.params.id} not found` };
    }
    const body = req.body;
    const filename = String(req.query.filename || 'file').slice(0, 200);
    if (!Buffer.isBuffer(body) || body.length === 0) {
      reply.code(400);
      return { error: 'send the file as the raw request body' };
    }
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const key = `tasks/${task.id}/${crypto.randomUUID()}-${filename}`;
    await s3.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: key, Body: body, ContentType: contentType }));
    const { rows } = await pool.query(
      `INSERT INTO attachments (task_id, key, filename, content_type, size)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, filename, content_type, size, created_at`,
      [task.id, key, filename, contentType, body.length],
    );
    await redis.del(TASKS_CACHE_KEY);
    await emit('attachment.added', task);
    reply.code(201);
    return rows[0];
  });

  // Streamed through the API: the bucket is never exposed to the browser.
  api.get('/attachments/:id', async (req, reply) => {
    const { rows } = await pool.query('SELECT key, filename, content_type FROM attachments WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (!rows[0]) {
      reply.code(404);
      return { error: 'attachment not found' };
    }
    const object = await s3.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: rows[0].key }));
    reply.header('Content-Type', rows[0].content_type);
    reply.header('Content-Disposition', `inline; filename="${rows[0].filename.replace(/"/g, '')}"`);
    return reply.send(object.Body);
  });

  // A read-only public link to one task, signed with ORBIT_SIGNING_SECRET.
  api.post('/tasks/:id/link', async (req, reply) => {
    const task = await findTask(Number(req.params.id));
    if (!task) {
      reply.code(404);
      return { error: `task ${req.params.id} not found` };
    }
    return { token: sign(task.id) };
  });

  api.get('/public/tasks/:token', async (req, reply) => {
    const id = verify(req.params.token);
    const task = id && (await findTask(id));
    if (!task) {
      reply.code(404);
      return { error: 'link not valid' };
    }
    return task;
  });

  api.get('/quiz/stream', (req, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    quizClients.add(res);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
    req.raw.on('close', () => {
      clearInterval(heartbeat);
      quizClients.delete(res);
    });
  });

  api.post('/quiz/broadcast', async () => {
    const quiz = QUIZZES[Math.floor(Math.random() * QUIZZES.length)];
    const event = `event: quiz\ndata: ${JSON.stringify(quiz)}\n\n`;
    for (const client of quizClients) client.write(event);
    return { delivered: quizClients.size, quiz };
  });

  api.post('/tasks/:id/share', async (req, reply) => {
    const id = Number(req.params.id);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!EMAIL_RE.test(email)) {
      reply.code(400);
      return { error: 'a valid recipient email address is required' };
    }
    if (!config.mailApiKey) {
      reply.code(503);
      return { error: 'email sending is not configured: set MAIL_API_KEY to enable sharing' };
    }
    const task = await findTask(id);
    if (!task) {
      reply.code(404);
      return { error: `task ${id} not found` };
    }
    // Resend is reached over plain HTTPS.
    let res;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.mailApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: config.mailFrom,
          to: [email],
          subject: `Orbit task shared: ${task.title}`,
          text: `A task from the Orbit board was shared with you.\n\nTitle: ${task.title}\nPriority: ${task.priority}`,
        }),
      });
    } catch (err) {
      reply.code(502);
      return { error: `mail provider unreachable: ${err.message}` };
    }
    const providerBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      reply.code(502);
      return { error: 'mail provider rejected the send', providerStatus: res.status };
    }
    return { ok: true, mailId: providerBody.id ?? null };
  });
}

app.register(apiRoutes, { prefix: '/api' });

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
