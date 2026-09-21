---
schema_version: 2
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
category: app
---

## Purpose
`orbit-api`: the Orbit backend app node — a single-file Fastify service exposing a task board (Postgres-backed, with an in-memory fallback), task sharing by email through Resend, and a Server-Sent-Events quiz broadcast channel. Built into a container image and run as a pod behind the preview router.

## Files
| Path | Role |
|---|---|
| services/api/src/server.js | The whole service: env config, `initDb`, the `health` handler, the `apiRoutes` plugin (tasks / share / quiz), `findTask`, `EMAIL_RE`, the `QUIZZES` bank, the `quizClients` set, and `start` |
| services/api/package.json | Name `orbit-api`, ESM (`"type": "module"`), `engines.node >= 20`, deps `fastify ^4.28.1` + `pg ^8.12.0`, `start` → `node src/server.js` |
| services/api/package-lock.json | lockfileVersion 3; resolves `fastify` 4.29.1 and `pg` 8.22.0. Required by the image build (`npm ci`) |
| services/api/Dockerfile | `node:20-alpine`, copies both manifests, `npm ci --omit=dev`, copies the source, `ENV PORT=8083`, `EXPOSE 8083`, `CMD ["node", "src/server.js"]` |
| services/api/.dockerignore | Keeps `node_modules`, `npm-debug.log`, `.git` out of the build context |
| services/api/.gitignore | Ignores `node_modules/` and re-includes the lockfile with `!package-lock.json`, overriding the repo-root `.gitignore` which excludes it |
| services/api/.infrar/build.yaml | Infrar build spec: `dockerfile: Dockerfile` plus the `env:` wiring. Also still carries the legacy `strategy`, `run.port` and `healthcheck` keys |
| services/api/.infrar/iac-preview/api-pod.yaml | The node's Kubernetes Pod manifest — the authoritative statement of `containerPort: 8083` and the `readinessProbe` on `/health` |
| services/api/README.md | Short node readme; still lists `GET /health`, `GET /tasks`, `POST /tasks` at the root, i.e. before the `/api` prefix move |

## Surface
**Exposes** — listens on `0.0.0.0:${PORT}`, default `8083`. An unprefixed `GET /health`, kept for the pod's readiness probe which hits the container directly and does not go through the preview router. Under `/api`, from the `apiRoutes` plugin registered with `{ prefix: '/api' }`: `GET /api/health` → `{ status, storage }`; `GET /api/tasks`; `POST /api/tasks` `{ title, priority? }` → 201; `POST /api/tasks/:id/share` `{ email }`; `GET /api/quiz/stream` (SSE, `event: quiz`); `POST /api/quiz/broadcast` `{ question?, options?, answer? }` → `{ delivered, quiz }`. Start command `npm start` (`node src/server.js`). `build.yaml` omits `run.api_prefix`, which is exactly the `/api` default the routes serve under.

**Consumes** — env: `DATABASE_URL` (`from: orbit`, the database node the project graph extracts from the `deploy` Terraform; the preview injects the synthesized Postgres URL), `PORT` (default `"8083"`), `MAIL_API_KEY` (`secret: true`, a Resend API key), `MAIL_FROM` (default `orbit@mail.infrar.io`). Packages: `fastify`, `pg`. External services: Postgres over the `pg` wire protocol, and the Resend REST API (`POST https://api.resend.com/emails`) over Node 20's global `fetch`.

## Behavior
`start()` awaits `initDb()` then `app.listen({ port: PORT, host: '0.0.0.0' })`, logging and `process.exit(1)` on failure. `initDb` warns and leaves `pool` null when `DATABASE_URL` is unset — every read and write then falls back to the module-level `memory` array with `nextId`, so the service is always runnable. With a URL it opens a `pg.Pool`, runs `CREATE TABLE IF NOT EXISTS tasks` (`id SERIAL PRIMARY KEY`, `title TEXT NOT NULL`, `priority TEXT NOT NULL DEFAULT 'medium'`, `done BOOLEAN NOT NULL DEFAULT false`) and seeds two sample rows when `SELECT COUNT(*)` returns zero. All table setup happens here at boot; there is no migration tool and no `bootstrap:` step.

`health` reports `storage: 'postgres'` when `pool` is set and `'memory'` otherwise — the orbit-web header chip reads that field. It is mounted twice: bare `/health` for the pod probe, `/api/health` inside the plugin for the frontend.

`GET/POST /api/tasks` query Postgres when connected and the array otherwise; `POST` rejects a missing `title` with 400 and returns the inserted row via `RETURNING`. `POST /api/tasks/:id/share` validates the id as an integer and the recipient against `EMAIL_RE` (400 each), answers 503 while `MAIL_API_KEY` is unset, resolves the task through `findTask` (404 when absent), then POSTs a plain-text email (title, priority, open/done status) to Resend with `Authorization: Bearer`. A throwing `fetch` or a non-2xx reply becomes 502 carrying `providerStatus`/`providerMessage`; both outcomes are logged with the task id, readable off the preview logs.

`GET /api/quiz/stream` hijacks the reply, writes the SSE headers itself, sends `: connected`, registers the raw response in `quizClients`, pings `: ping` every 25s, and clears both the interval and the set entry when the request closes. `POST /api/quiz/broadcast` uses the posted quiz when `question` is present (400 unless `options` is an array of at least 2), otherwise picks one of the built-in `QUIZZES`, and writes one `event: quiz` frame to every connected client.

## Notes
- A pod manifest exists at `.infrar/iac-preview/api-pod.yaml`, so it — not `build.yaml` — is what states the serving port, the start command and the readiness probe. The `run.port` and `healthcheck` keys still sitting in `build.yaml` are parsed only for specs without a manifest and are ignored here; changing the port or the probe means editing the manifest, and editing the spec instead is a change that appears to work and does nothing. `strategy:` is likewise legacy — never write it again.
- The `/api` prefix is the contract with the preview router, which forwards `/api/*` from the web origin **without stripping it**. Moving routes back to the root, or setting `run.api_prefix`, 404s every frontend call. Keep the plugin at `/api` and keep the bare `/health` for the probe path the manifest declares.
- Bind stays `0.0.0.0`; the platform reaches the pod over the network, never localhost.
- `DATABASE_URL` is wired `from: orbit`, not `from: deploy` — `orbit` is the database node the graph derives from `aws_db_instance.orbit` in the `deploy` root. A `from:` naming no node stays silently unset. A stale comment in `server.js` still calls it "the `db` node".
- `build.yaml` declares no `requires:` for Postgres and the repository has no `.infrar/environment/`, even though the code speaks to Postgres through `pg`. The dependency reaches the pod today only via the `from: orbit` wiring.
- SQL used is plain and portable — `SERIAL`, `CREATE TABLE IF NOT EXISTS`, `RETURNING`, `::int`, positional `$n` parameters — with no extension and no feature newer than Postgres 9.5; the `deploy` root pins engine 16, and `pg` 8.x speaks to every server in that range.
- `npm ci` fails on a lockfile out of sync with `package.json`, so refresh `package-lock.json` with any dependency change. Never drop the `!package-lock.json` negation in `services/api/.gitignore`: without it the lockfile leaves the build context and the Dockerfile `COPY` step fails.
- The base image must be a tag that really exists — it was once pinned to `node:20.99.99-alpine` and every build failed; it is `node:20-alpine`. Node 20 is also the floor for the global `fetch` the share route relies on.
- Mail is HTTPS-only by design: SMTP ports are blocked in preview, so do not introduce nodemailer or any SMTP client.
- `memory`, `nextId` and `quizClients` are per-process: they reset on restart, and a broadcast only reaches clients attached to the same pod instance.
