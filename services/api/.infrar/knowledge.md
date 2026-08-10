---
schema_version: 1
id: 8ed247c7-af49-4d49-a5da-6160ce873529
name: api
node: services/api
category: app
---
## Purpose
`orbit-api` is the task API for the Orbit demo project: a small HTTP service exposing health and task CRUD (list/create) endpoints. It is built with Fastify and backed by Postgres, and is packaged as a container image for deployment.

## Structure
Single-file Node.js (ES modules, Node >= 20) application:
- `src/server.js` — the entire service: Fastify setup, Postgres pool initialization, route handlers, and startup logic.
- `package.json` — declares the two runtime dependencies (`fastify` ^4, `pg` ^8) and the `start` script (`node src/server.js`).
- `Dockerfile` — `node:20-alpine` image; installs production dependencies, copies the source, sets `PORT=8080`, exposes 8080, and runs `node src/server.js`.
- `README.md` — endpoint and configuration summary; `.dockerignore` trims the build context.

## Behavior
On startup, `initDb()` checks `DATABASE_URL`. If set, it creates a `pg.Pool`, ensures a `tasks` table exists (`id SERIAL`, `title TEXT`, `priority TEXT` default `'medium'`, `done BOOLEAN` default `false`), and seeds two demo rows if the table is empty. If unset, it logs a warning and falls back to an in-memory array pre-populated with the same two demo tasks, so the service is always runnable without a database.

Routes:
- `GET /health` — liveness probe, returns `{ status: 'ok' }`.
- `GET /tasks` — returns all tasks ordered by id (from Postgres when a pool exists, otherwise from memory).
- `POST /tasks` — creates a task from `{ title, priority }`; `priority` defaults to `'medium'`; missing `title` returns 400 with `{ error: 'title is required' }`; success returns 201 with the created task (`done` starts false).

The server listens on `0.0.0.0` at `PORT` (default 8080) with Fastify's built-in logger enabled. Any startup failure (DB init or listen) is logged and the process exits with code 1.

## Dependencies
- Runtime: Node.js >= 20; npm packages `fastify` (HTTP framework) and `pg` (Postgres client).
- Environment variables: `DATABASE_URL` (optional Postgres connection string) and `PORT` (optional, default 8080).
- External service: a Postgres database when `DATABASE_URL` is provided. In this repo that corresponds to the RDS Postgres declared in the `deploy` iac node; in an Infrar Application Preview it is wired from the preview's synthesized `db` node instead.
- Docker for image builds (no build step — plain JS, dependencies installed with `npm install --omit=dev`).

## Notes
- The in-memory fallback is intentionally non-persistent and single-instance; data written without `DATABASE_URL` is lost on restart and not shared across replicas.
- Schema migration is limited to `CREATE TABLE IF NOT EXISTS` at startup; there is no migration tooling.
- There is no authentication, input validation beyond the `title` presence check, update/delete endpoints, or test suite — consistent with a minimal demo service.
- No lockfile is present; the Dockerfile copies only `package.json` before `npm install`, so builds resolve dependency versions at build time.
