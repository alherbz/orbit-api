---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
category: app
---
## Purpose
`orbit-api` is the task API for the Orbit demo project: a small HTTP service exposing a health check and task list/create endpoints. It is built with Fastify, optionally backed by Postgres, and packaged as a container image for deployment.

## Structure
Single-file Node.js application (ES modules, Node >= 20):
- `src/server.js` — the entire service: Fastify setup, Postgres pool initialization, route handlers, and startup logic.
- `package.json` — declares the two runtime dependencies (`fastify` ^4.28, `pg` ^8.12) and the `start` script (`node src/server.js`).
- `Dockerfile` — `node:20-alpine` base; installs production dependencies from `package.json`, copies the source, sets `PORT=8080`, exposes 8080, runs `node src/server.js`.
- `README.md` — endpoint and configuration summary; `.dockerignore` trims the Docker build context.

## Behavior
On startup, `initDb()` checks `DATABASE_URL`. If set, it creates a `pg.Pool`, ensures a `tasks` table exists (`id SERIAL PRIMARY KEY`, `title TEXT NOT NULL`, `priority TEXT` default `'medium'`, `done BOOLEAN` default `false`), and seeds two demo rows if the table is empty. If unset, it logs a warning and serves from an in-memory array pre-populated with the same two demo tasks, so the service never hard-fails without a database.

Routes:
- `GET /health` — liveness probe, returns `{ status: 'ok' }`.
- `GET /tasks` — returns all tasks ordered by id (from Postgres when a pool exists, otherwise from memory).
- `POST /tasks` — creates a task from `{ title, priority }`; `priority` defaults to `'medium'`; a missing `title` returns 400 with `{ error: 'title is required' }`; success returns 201 with the created task (`done` starts false).

The server listens on `0.0.0.0` at `PORT` (default 8080) with Fastify's built-in logger enabled. Any startup failure (DB init or listen) is logged and the process exits with code 1.

## Dependencies
- Runtime: Node.js >= 20; npm packages `fastify` (HTTP framework) and `pg` (Postgres client).
- Environment variables: `DATABASE_URL` (optional Postgres connection string) and `PORT` (optional, default 8080).
- External service: a Postgres database when `DATABASE_URL` is provided. In this repo that corresponds to the RDS Postgres declared in the `deploy` iac node; in an Infrar Application Preview the connection is wired from the preview's synthesized `db` node instead.
- Docker for image builds (no build/transpile step — plain JS, dependencies installed with `npm install --omit=dev`).

## Notes
- The in-memory fallback is intentionally non-persistent and single-instance; tasks created without `DATABASE_URL` are lost on restart and not shared across replicas.
- Schema management is limited to `CREATE TABLE IF NOT EXISTS` at startup; there is no migration tooling.
- There is no authentication, no input validation beyond the `title` presence check, no update/delete endpoints, and no test suite — consistent with a minimal demo service.
- No lockfile is committed and the Dockerfile copies only `package.json` before `npm install`, so dependency versions are resolved at image build time (non-reproducible builds).
