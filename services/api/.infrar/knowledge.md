---
schema_version: 2
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
category: app
---

## Purpose
`orbit-api`: the Orbit backend app node — a single-file Fastify service exposing a task board (Postgres-backed, with an in-memory fallback), a Redis-backed cache for the task list (also with an in-memory fallback), task sharing by email, and a Server-Sent-Events quiz broadcast channel. Packaged as a container image and run as a pod behind the preview router.

## Files
| Path | Role |
|---|---|
| services/api/src/server.js | The entire service: config from env, `initDb`, `initCache` with `cacheGet`/`cacheSet`/`cacheDrop`, the `health` handler, the `apiRoutes` plugin (tasks / share / quiz), `findTask`, `EMAIL_RE`, `QUIZZES`, and the `start` listener |
| services/api/package.json | Name `orbit-api`, ESM (`"type": "module"`), `engines.node >= 20`, deps `fastify` + `pg` + `redis`, `start` → `node src/server.js` |
| services/api/Dockerfile | `node:20-alpine`, `npm ci --omit=dev` from the copied manifests, `ENV PORT=8083`, `CMD ["node", "src/server.js"]` |
| services/api/.dockerignore | Keeps `node_modules`, `npm-debug.log`, `.git` out of the build context |
| services/api/.gitignore | Ignores `node_modules/` and re-includes the lockfile with `!package-lock.json` (the repo-root `.gitignore` excludes it) |
| services/api/.infrar/build.yaml | Infrar build spec: `strategy: dockerfile`, the `requires:` entries (`db` → postgres, `cache` → redis, `mail` → mailpit) with their `env:` projections, and the node's own `env:` list |
| services/api/.infrar/iac-preview/api-pod.yaml | The pod manifest — the operative statement of how the node runs: `containerPort: 8083` and the `/health` readiness probe |
| services/api/README.md | Short node readme; **stale** — still lists the routes at the root, before the `/api` prefix move, and mentions neither Redis nor mail |

## Surface
**Exposes** — listens on `0.0.0.0:${PORT}` (default `8083`). Unprefixed `GET /health` (kept for the pod's readiness probe, which hits the container path directly). Under the `/api` base path, from the `apiRoutes` plugin registered with `{ prefix: '/api' }`: `GET /api/health` → `{ status, storage }`; `GET /api/tasks` (cached); `POST /api/tasks` `{ title, priority? }` → 201; `POST /api/tasks/:id/share` `{ email }`; `GET /api/quiz/stream` (SSE, `event: quiz`); `POST /api/quiz/broadcast` `{ question?, options?, answer? }` → `{ delivered, quiz }`. Command: `npm start`. `build.yaml` declares no API-prefix key, so the platform default applies.

**Consumes** — env: `DATABASE_URL` (projected by the `db` requirement, product postgres `>=15 <17`, `tenancy: database`), `REDIS_URL` (the `cache` requirement, product redis `>=6`), `SMTP_URL` (the `mail` requirement, product mailpit — **declared but never read by the code**), `PORT` (default `8083`), `MAIL_API_KEY` (`secret: true`, Resend API key), `MAIL_FROM` (default `orbit@mail.infrar.io`). Packages: `fastify`, `pg`, `redis` (node-redis v6). Services: Postgres, Redis, and the Resend REST API (`POST https://api.resend.com/emails`) over Node 20's global `fetch`.

## Behavior
`start()` runs `initDb()`, then `initCache()`, then listens. `initDb` logs a warning and leaves `pool` null when `DATABASE_URL` is unset — every read/write then falls back to the module-level `memory` array with `nextId`, so the service is always runnable. With a URL it opens a `pg.Pool`, creates the `tasks` table if missing (`id serial`, `title`, `priority` default `medium`, `done` default false) and seeds two sample rows when the table is empty.

`initCache` mirrors that shape for the cache: without `REDIS_URL` it warns and leaves `redis` null, so `cacheGet`/`cacheSet`/`cacheDrop` operate on the process-local `memoryCache` map (entries carry an `expiresAt` checked on read). With a URL it opens a node-redis client, registers an `error` logger and connects; a connect failure is caught and logged, leaving the node on the in-memory map rather than failing the boot. Every cache call is wrapped so a Redis error degrades to a miss instead of surfacing as a 500. `GET /api/tasks` returns the cached list when present, otherwise reads Postgres (or `memory`) and stores the result under `tasks:all` for `TASKS_CACHE_TTL` (30s); `POST /api/tasks` drops that key after inserting, in both the Postgres and the in-memory branch.

`health` reports `storage: 'postgres'` when `pool` is set and `'memory'` otherwise — the orbit-web header chip reads that field. It is mounted twice: bare `/health` for the pod probe and `/api/health` inside the plugin for the frontend.

`POST /api/tasks` rejects a missing `title` with 400. `POST /api/tasks/:id/share` validates the id as an integer and the recipient against `EMAIL_RE` (400), answers 503 while `MAIL_API_KEY` is unset, resolves the task via `findTask` (404 when absent), then POSTs a plain-text email (title, priority, open/done status) to Resend with `Authorization: Bearer`. An unreachable provider or a non-2xx reply becomes 502 carrying `providerStatus`/`providerMessage`; both outcomes are logged with the task id for reading off the preview logs.

`GET /api/quiz/stream` hijacks the reply, writes the SSE headers itself, registers the raw response in the `quizClients` set, sends `: connected`, pings `: ping` every 25s, and clears both the interval and the set entry on client close. `POST /api/quiz/broadcast` uses the posted quiz when `question` is present (400 unless `options` is an array of ≥2), otherwise picks one of the built-in `QUIZZES`, and writes an `event: quiz` frame to every connected client.

## Notes
- **The `mail` requirement is undeclared and unused, in both directions.** `build.yaml` requires product `mailpit` projecting `SMTP_URL`, but (a) `.infrar/environment/resources.tf`/`outputs.tf` carry only `module "db"` and `module "cache"` — there is no `mail` module, so the repository's declarations lag the `requires:` entry and the resource is not realised; and (b) `src/server.js` never reads `SMTP_URL` — sharing goes to Resend over HTTPS with `MAIL_API_KEY`. Resolving this is a choice, not a mechanical fix: either add the environment declaration and switch the share path to the SMTP sink, or drop the `mail` requirement. Note the in-code comment on `/api/tasks/:id/share` asserts SMTP ports are blocked in preview, which contradicts a mailpit SMTP sink; verify before wiring nodemailer or any SMTP client.
- The `/api` prefix is the contract with the preview router, which forwards `/api/*` from the web origin **without stripping it**. Moving routes back to the root, or setting an API-prefix key, breaks every frontend call (404). Keep the plugin mounted at `/api` and the bare `/health` in place, and keep the probe path in the pod manifest equal to that unprefixed route.
- Bind stays `0.0.0.0`; the platform reaches the pod over the network, never localhost.
- Dependencies are projected by `requires:` entries, not by `from:` on an `env:` entry — `DATABASE_URL` was migrated off `from: orbit` (the database node extracted from the `deploy` Terraform) to `requires.db`. A variable that no requirement and no `env:` entry declares stays silently unset. A stale comment in `server.js` still says `DATABASE_URL` comes "from the `db` node"; it is the `db` requirement.
- Every requirement added to `build.yaml` needs a matching `module`/`output` pair under `/.infrar/environment/` or it is never provisioned — `db` and `cache` have theirs, `mail` does not.
- The cache is deliberately optional: no `optional: true` is set on the `cache` requirement (the preview provides one), but no code path may assume it — a Redis outage must stay a cache miss.
- Cache invalidation only covers writes that go through `POST /api/tasks`. Rows changed directly in Postgres stay stale for up to the 30s TTL, and `memoryCache` is per-process, so two pod replicas hold independent copies. Any new task-mutating route must call `cacheDrop(TASKS_CACHE_KEY)`. In the no-Postgres branch `cacheSet` stores the live `memory` array by reference, so that path never actually observes staleness — do not read a green in-memory run as proof the invalidation is correct.
- node-redis v6 takes the TTL as `{ expiration: { type: 'EX', value } }`; the flat `{ EX: n }` form is deprecated.
- `npm ci` fails on a lockfile out of sync with `package.json`, so refresh `package-lock.json` with any dependency change. Never drop the `!package-lock.json` negation in `services/api/.gitignore`: without it the lockfile leaves the build context and the Dockerfile `COPY` step fails.
- The base image must be a tag that exists — it was once pinned to `node:20.99.99-alpine` and every build failed; it is `node:20-alpine`. Node 20 is also required for the global `fetch` the share route relies on.
- `memory`, `nextId`, `memoryCache` and `quizClients` are per-process: they reset on restart and a broadcast only reaches clients attached to the same pod instance.
- The pod manifest is the operative statement of port, command, probe and writable mounts; the legacy `run:`/`healthcheck:` keys still in `build.yaml` are redundant while it exists. Keep the three `8083`s (Dockerfile `ENV`/`EXPOSE`, `build.yaml`, pod manifest) in step if the port ever moves.
- `.infrar/` files marked `-merge` in `services/api/.infrar/.gitattributes` (`knowledge.md`, `commit.md`, `iac-preview/**`) are regenerated on conflict, never hand-merged; `build.yaml` is authored and merges normally on purpose.
