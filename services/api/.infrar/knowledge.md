---
schema_version: 2
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
category: app
---

## Purpose
`orbit-api`: the Orbit backend **app** node — a single-file Fastify service serving a task board (Postgres-backed, with an in-memory fallback), task sharing by email through the Resend HTTP API, and a Server-Sent-Events quiz broadcast channel. Built into a container image and run as a pod behind the preview router, which forwards `/api/*` from the web origin to it.

## Files
| Path | Role |
|---|---|
| services/api/src/server.js | The entire service: env reads (`PORT`, `DATABASE_URL`, `MAIL_API_KEY`, `MAIL_FROM`), the `memory`/`nextId` fallback store, `initDb`, the shared `health` handler, the bare `app.get('/health')`, the `apiRoutes` plugin (quiz, tasks, share) registered with `{ prefix: '/api' }`, `findTask`, `EMAIL_RE`, the `QUIZZES` bank, the `quizClients` set, and `start` |
| services/api/package.json | Name `orbit-api`, ESM (`"type": "module"`), `engines.node >= 20`, deps `fastify ^4.28.1` and `pg ^8.12.0`, single script `start` → `node src/server.js` |
| services/api/Dockerfile | `node:20-alpine`, `WORKDIR /app`, copies both manifests, `npm ci --omit=dev`, copies the source, `ENV PORT=8083`, `EXPOSE 8083`, `CMD ["node", "src/server.js"]` |
| services/api/.dockerignore | Keeps `node_modules`, `npm-debug.log` and `.git` out of the build context |
| services/api/.gitignore | Ignores `node_modules/` and re-includes the lockfile via `!package-lock.json`, overriding the repo-root `.gitignore` which excludes `package-lock.json` |
| services/api/.infrar/build.yaml | Infrar build spec: `dockerfile: Dockerfile` and the `env:` wiring. Declares **no** `requires:`; still carries the legacy `strategy`, `run.port` and `healthcheck` keys |
| services/api/.infrar/iac-preview/api-pod.yaml | The node's Kubernetes Pod manifest — the authoritative statement of `containerPort: 8083` and the `readinessProbe` `httpGet /health:8083` (`initialDelaySeconds: 3`, `periodSeconds: 5`) |
| services/api/README.md | Short node readme; still documents `GET /health`, `GET /tasks`, `POST /tasks` at the root, i.e. the pre-`/api` surface |

## Surface
**Exposes** — listens on `0.0.0.0:${PORT}`, default `8083` (the Dockerfile also sets `ENV PORT=8083`). One unprefixed route, `GET /health`, kept for the pod readiness probe that hits the container directly without passing the preview router. Everything else comes from the `apiRoutes` plugin under `/api`: `GET /api/health` → `{ status: 'ok', storage }`; `GET /api/tasks` (ordered by id); `POST /api/tasks` `{ title, priority? }` → 201 with the created row, 400 without `title`; `POST /api/tasks/:id/share` `{ email }` → `{ ok, mailId }`; `GET /api/quiz/stream` (SSE, frames `event: quiz`); `POST /api/quiz/broadcast` `{ question?, options?, answer? }` → `{ delivered, quiz }`. Start command `node src/server.js` (`npm start`). `build.yaml` omits `run.api_prefix`, which is exactly the `/api` default the routes serve under.

**Consumes** — env, as declared in `build.yaml`: `DATABASE_URL` (`from: orbit` — the database node the project graph derives from `aws_db_instance.orbit` in the `deploy` Terraform root; the preview injects the synthesized Postgres connection string), `PORT` (`default: "8083"`), `MAIL_API_KEY` (`secret: true`, a Resend API key), `MAIL_FROM` (`default: orbit@mail.infrar.io`). Packages: `fastify`, `pg`. External services: a Postgres server over the `pg` wire protocol, and the Resend REST API (`POST https://api.resend.com/emails`) over Node 20's global `fetch`.

## Behavior
`start()` awaits `initDb()` and then `app.listen({ port: PORT, host: '0.0.0.0' })`, logging the error and `process.exit(1)` on failure. `initDb` warns and leaves `pool` null when `DATABASE_URL` is unset — every read and write then falls back to the module-level `memory` array with `nextId`, so the service is always runnable. With a URL it opens a `pg.Pool`, runs `CREATE TABLE IF NOT EXISTS tasks` (`id SERIAL PRIMARY KEY`, `title TEXT NOT NULL`, `priority TEXT NOT NULL DEFAULT 'medium'`, `done BOOLEAN NOT NULL DEFAULT false`) and seeds two sample rows when `SELECT COUNT(*)::int` returns zero. All schema setup happens here, at boot, in-process: there is no migration tool and no `bootstrap:` step.

`health` reports `storage: 'postgres'` when `pool` is set and `'memory'` otherwise — the orbit-web header chip reads that field. The same handler is mounted twice: bare `/health` for the pod probe, `/api/health` inside the plugin for the frontend.

`GET/POST /api/tasks` query Postgres when connected and the array otherwise; the insert returns the row through `RETURNING`. `POST /api/tasks/:id/share` validates the id with `Number.isInteger` and the trimmed recipient against `EMAIL_RE` (400 each), answers **503** while `MAIL_API_KEY` is unset, resolves the task through `findTask` (404 when absent), then POSTs a plain-text email (title, priority, open/done status) to Resend with `Authorization: Bearer ${MAIL_API_KEY}`. A throwing `fetch` and a non-2xx reply both become **502**, the latter carrying `providerStatus`/`providerMessage`; every outcome is logged with the task id, readable off the preview logs.

`GET /api/quiz/stream` hijacks the reply, writes the SSE headers itself (`text/event-stream`, `no-cache, no-transform`, `keep-alive`), sends `: connected`, registers the raw response in `quizClients`, pings `: ping` every 25 s and clears both the interval and the set entry on request `close`. `POST /api/quiz/broadcast` uses the posted quiz when `question` is present (400 unless `options` is an array of at least 2), otherwise picks one of the three built-in `QUIZZES`, and writes a single `event: quiz` frame to every connected client.

## Notes
- A pod manifest exists, so **it** — not `build.yaml` — states the serving port, the start command and the readiness probe. The `run.port` and `healthcheck` keys still sitting in the spec are parsed only for nodes without a manifest and are ignored here: changing the port or the probe means editing `iac-preview/api-pod.yaml`, and editing the spec instead is a change that appears to work and does nothing. `strategy: dockerfile` is likewise legacy — never write it again.
- The `/api` prefix is the contract with the preview router, which forwards `/api/*` from the web origin **without stripping it**. Moving the routes back to the root, or setting `run.api_prefix`, 404s every frontend call. Keep the plugin at `/api` and keep the bare `/health` for the probe path the manifest declares.
- Bind stays `0.0.0.0`; the platform reaches the pod over the network, never localhost.
- `DATABASE_URL` is wired `from: orbit`, not `from: deploy` — `orbit` is the database node the graph derives from `aws_db_instance.orbit`. That was an actual bug fixed once (`Wire DATABASE_URL from the deploy node` → `Fix DATABASE_URL preview wiring: from orbit database node`): a `from:` naming no node stays silently unset and the API quietly serves the in-memory store. A stale comment in `server.js` still calls it "the `db` node".
- `build.yaml` declares no `requires:` for Postgres and the repository has no `.infrar/environment/`, even though the code speaks to Postgres through `pg`. The dependency reaches the pod today only through the `from: orbit` wiring.
- The SQL is plain and portable — `SERIAL`, `CREATE TABLE IF NOT EXISTS`, `RETURNING`, `::int`, positional `$n` parameters — with no extension and nothing newer than Postgres 9.5. `deploy` pins engine `16`, and `pg` 8.x speaks to every server in that range. The committed lockfile (v3) resolves `fastify` 4.29.1 and `pg` 8.22.0.
- `npm ci` fails on a lockfile out of sync with `package.json`, so refresh `package-lock.json` with any dependency change, and never drop the `!package-lock.json` negation in `services/api/.gitignore`: without it the lockfile leaves the tree and the Dockerfile `COPY package.json package-lock.json ./` step fails.
- The base image must be a tag that really exists. It was pinned to `node:20.99.99-alpine` **twice** and every build failed both times; it is `node:20-alpine`. Node 20 is also the floor for the global `fetch` the share route relies on.
- Mail is HTTPS-only by design: SMTP ports are blocked in preview, so do not introduce nodemailer or any SMTP client.
- `memory`, `nextId` and `quizClients` are per-process: they reset on restart, and a broadcast only reaches clients attached to that same pod instance.
