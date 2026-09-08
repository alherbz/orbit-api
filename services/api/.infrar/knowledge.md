---
schema_version: 2
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
category: app
---

## Purpose
`orbit-api`: the Orbit backend app node — a single-file Fastify service exposing a task board (Postgres-backed, with an in-memory fallback), task sharing by email, and a Server-Sent-Events quiz broadcast channel. Packaged as a container image and run as a pod behind the preview router.

## Files
| Path | Role |
|---|---|
| services/api/src/server.js | The entire service: config from env, `initDb`, the `health` handler, the `apiRoutes` plugin (tasks / share / quiz), `findTask`, and the `start` listener |
| services/api/package.json | Name `orbit-api`, ESM (`"type": "module"`), `engines.node >= 20`, deps `fastify` + `pg`, `start` → `node src/server.js` |
| services/api/Dockerfile | `node:20-alpine`, `npm ci --omit=dev` from the copied manifests, `ENV PORT=8083`, `CMD ["node", "src/server.js"]` |
| services/api/.dockerignore | Keeps `node_modules`, `npm-debug.log`, `.git` out of the build context |
| services/api/.gitignore | Ignores `node_modules/` and re-includes the lockfile with `!package-lock.json` (the repo-root `.gitignore` excludes it) |
| services/api/.infrar/build.yaml | Infrar build/run spec: `strategy: dockerfile`, `run.port: 8083`, healthcheck `/health`, and the `env:` wiring |
| services/api/README.md | Short node readme; still lists the routes at the root, before the `/api` prefix move |

## Surface
**Exposes** — listens on `0.0.0.0:${PORT}` (default `8083`). Unprefixed `GET /health` (kept for the pod's container healthcheck, which probes the path in `build.yaml` directly). Under the `/api` base path, from the `apiRoutes` plugin registered with `{ prefix: '/api' }`: `GET /api/health` → `{ status, storage }`; `GET /api/tasks`; `POST /api/tasks` `{ title, priority? }` → 201; `POST /api/tasks/:id/share` `{ email }`; `GET /api/quiz/stream` (SSE, `event: quiz`); `POST /api/quiz/broadcast` `{ question?, options?, answer? }` → `{ delivered, quiz }`. Command: `npm start`. `build.yaml` omits `run.api_prefix`, i.e. the `/api` default.

**Consumes** — env: `DATABASE_URL` (`from: orbit`, the database node the project graph extracts from the `deploy` Terraform; the preview injects the synthesized Postgres URL), `PORT` (default `8083`), `MAIL_API_KEY` (`secret: true`, Resend API key), `MAIL_FROM` (default `orbit@mail.infrar.io`). Packages: `fastify`, `pg`. Services: Postgres, and the Resend REST API (`POST https://api.resend.com/emails`) over Node 20's global `fetch`.

## Behavior
`start()` runs `initDb()` then listens. `initDb` logs a warning and leaves `pool` null when `DATABASE_URL` is unset — every read/write then falls back to the module-level `memory` array with `nextId`, so the service is always runnable. With a URL it opens a `pg.Pool`, creates the `tasks` table if missing (`id serial`, `title`, `priority` default `medium`, `done` default false) and seeds two sample rows when the table is empty.

`health` reports `storage: 'postgres'` when `pool` is set and `'memory'` otherwise — the orbit-web header chip reads that field. It is mounted twice: bare `/health` for the pod probe and `/api/health` inside the plugin for the frontend.

`GET/POST /api/tasks` query Postgres when connected, else the array; `POST` rejects a missing `title` with 400. `POST /api/tasks/:id/share` validates the id as an integer and the recipient against `EMAIL_RE` (400), answers 503 while `MAIL_API_KEY` is unset, resolves the task via `findTask` (404 when absent), then POSTs a plain-text email (title, priority, open/done status) to Resend with `Authorization: Bearer`. An unreachable provider or a non-2xx reply becomes 502 carrying `providerStatus`/`providerMessage`; both outcomes are logged with the task id for reading off the preview logs.

`GET /api/quiz/stream` hijacks the reply, writes the SSE headers itself, registers the raw response in the `quizClients` set, sends `: connected`, pings `: ping` every 25s, and clears both the interval and the set entry on client close. `POST /api/quiz/broadcast` uses the posted quiz when `question` is present (400 unless `options` is an array of ≥2), otherwise picks one of the built-in `QUIZZES`, and writes an `event: quiz` frame to every connected client.

## Notes
- The `/api` prefix is the contract with the preview router, which forwards `/api/*` from the web origin **without stripping it**. Moving routes back to the root, or setting `run.api_prefix`, breaks every frontend call (404). Keep the plugin mounted at `/api` and the bare `/health` in place, and keep the healthcheck path in `build.yaml` equal to that unprefixed route.
- Bind stays `0.0.0.0`; the platform reaches the pod over the network, never localhost.
- `npm ci` fails on a lockfile out of sync with `package.json`, so refresh `package-lock.json` with any dependency change. Never drop the `!package-lock.json` negation in `services/api/.gitignore`: without it the lockfile leaves the build context and the Dockerfile `COPY` step fails.
- The base image must be a tag that exists — it was once pinned to `node:20.99.99-alpine` and every build failed; it is `node:20-alpine`.
- `DATABASE_URL` is wired `from: orbit`, not `from: deploy`; a `from:` naming no node stays silently unset. A stale in-code comment still says "the `db` node".
- Mail is HTTPS-only by design: SMTP ports are blocked in preview, so do not introduce nodemailer or any SMTP client. Node 20 is required for the global `fetch` this relies on.
- `memory`, `nextId` and `quizClients` are per-process: they reset on restart and a broadcast only reaches clients attached to the same pod instance.
