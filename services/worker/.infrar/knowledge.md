---
schema_version: 2
id: 45da285f-926c-40a6-a2c6-9039fe506b6e
name: worker
node: services/worker
category: app
---

## Purpose

Consumes task events from Redis and records human-readable entries in the Postgres activity feed.

## Files

| Path | Role |
| --- | --- |
| `services/worker/src/worker.js` | Worker entrypoint, queue consumer, message formatting, and activity insert. |
| `services/worker/package.json` | Node.js runtime requirement, start command, and direct dependencies. |
| `services/worker/Dockerfile` | Node 20 container build and startup command. |

## Surface

**Exposes:** `npm start` / `node src/worker.js` and a BullMQ consumer for the `task-events` queue; no HTTP route or listening port.

**Consumes:** `DATABASE_URL` and `REDIS_URL` (runtime-provided connection URLs; local `docker-compose.yml` sets them, while the deploy node outputs the infrastructure endpoints), `task-events` jobs produced by the API node, and the `pg`, `ioredis`, and `bullmq` packages. Uses the API-migrated Postgres `activity` table.

## Behavior

At startup, `worker.js` requires both connection URLs and exits with status 1 if either is absent. It creates a Postgres pool and Redis connection, then starts a BullMQ `Worker` on `task-events`. Each job inserts one `activity` row with `task_id` from `job.data.taskId`, `kind` from `job.name`, and a message derived from `job.data.title`. Known names are `task.created`, `task.completed`, `task.reopened`, and `attachment.added`; other names use a generic `<job name>: <title>` message. The worker logs readiness and job failures.

## Notes

The API must migrate the database before the worker writes to `activity`. Jobs are assumed to contain `taskId` and `title`; this worker does not validate them. The insert has no deduplication or transaction with queue acknowledgement, so a retried job can create another activity row. Redis uses `maxRetriesPerRequest: null`, as required for a long-running BullMQ worker.
