---
schema_version: 2
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
category: app
---

## Purpose

Fastify task API for Orbit: stores tasks and attachment metadata in Postgres, files in S3, caches lists in Redis, and sends task events to the worker. It also serves readiness, public task links, a quiz stream, and optional email sharing.

## Files

| Path | Role |
| --- | --- |
| `services/api/src/server.js` | HTTP routes, task and attachment flows, signed links, quiz SSE, email sharing. |
| `services/api/src/config.js` | Required and optional environment configuration; exits when a required value is absent. |
| `services/api/src/deps.js` | Postgres pool, Redis client, BullMQ queue, S3 client, and readiness probes. |
| `services/api/src/migrate.js` | Applies SQL migrations in filename order, transactionally, tracked by `schema_migrations`. |
| `services/api/src/seed.js` | Inserts demo tasks and activity only when the tasks table is empty. |
| `services/api/migrations/001_tasks.sql` | Tasks schema. |
| `services/api/migrations/002_activity.sql` | Worker-written activity schema. |
| `services/api/migrations/003_attachments.sql` | Attachment metadata schema. |
| `services/api/package.json` | Node 20+ dependencies and `start`, `migrate`, `seed` commands. |
| `services/api/Dockerfile` | Node 20 Alpine image; starts the API and exposes port 8083. |
| `services/api/README.md` | Brief API usage note; its in-memory fallback claim is stale. |

## Surface

**Exposes:** `GET /health` and `GET /api/health`; under `/api`: `GET, POST /tasks`, `PATCH /tasks/:id`, `GET /activity`, `GET, POST /tasks/:id/attachments`, `GET /attachments/:id`, `POST /tasks/:id/link`, `GET /public/tasks/:token`, `GET /quiz/stream` (SSE), `POST /quiz/broadcast`, `POST /tasks/:id/share`. Commands: `npm start`, `npm run migrate`, `npm run seed`. Listens on `0.0.0.0:${PORT}` (default 8083); no exported library API.

**Consumes:** `DATABASE_URL` and `REDIS_URL` (runtime connection URLs; local `docker-compose.yml` sets them, while deploy outputs the Postgres and Redis endpoints), `S3_BUCKET` (runtime bucket name; deploy outputs it), `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (runtime S3 endpoint and credentials), `S3_REGION` (runtime, default `us-east-1`), `ORBIT_SIGNING_SECRET` (runtime shared-link secret), `PORT` (runtime, default 8083), `MAIL_API_KEY` and `MAIL_FROM` (optional runtime configuration for Resend; default sender `orbit@example.com`). Uses `fastify`, `pg`, `ioredis`, `bullmq`, and `@aws-sdk/client-s3`; calls Postgres, Redis/BullMQ `task-events`, S3, and Resend HTTPS when sharing.

## Behavior

Startup requires Postgres, Redis, signing secret, and S3 configuration; it does not apply migrations or create the S3 bucket. Both health routes probe the migrated `tasks` table, Redis ping, and S3 bucket head with two-second limits; any failure yields 503 and per-dependency status. Task listing reads a ten-second Redis cache populated from Postgres with attachment counts. Create, done/reopen, and attachment upload invalidate that cache and enqueue events for the worker, which writes activity; the API reads the 20 newest activity rows. Uploads accept a raw file body (5 MiB Fastify limit), store it in S3, then insert metadata; downloads stream through the API. Signed links use HMAC-SHA256 over the task ID and return one task read-only. Quiz SSE clients are held per API process with heartbeat comments; broadcast sends a random quiz to connected clients. Sharing validates an email, requires `MAIL_API_KEY`, and sends task details to Resend.

## Notes

Run `npm run migrate` before serving and after schema changes; `npm run seed` requires migrated tables and skips all seed data when any task exists. `services/api/README.md` describes an in-memory fallback, but `src/config.js` requires `DATABASE_URL` and other dependencies and exits if missing. The web forwarder must preserve `/api`; only the root health route exists outside that prefix. Routes have no authentication or authorization; public-link signatures depend on keeping `ORBIT_SIGNING_SECRET` stable and private. Redis cache invalidation and queue publication follow committed database writes, so failures there can leave a persisted mutation with an error response or stale cache; S3 upload precedes metadata insertion and can leave an orphaned object if the insert fails. Quiz subscriptions and broadcasts are process-local. The bucket must already exist.
