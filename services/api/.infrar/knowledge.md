---
schema_version: 2
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
category: app
---

## Purpose
`orbit-api`: the Orbit backend app node — a Fastify service exposing a task board (Postgres-backed, with an in-memory fallback), a cached task list (Redis, with an in-memory fallback), task sharing by email via Resend, a Server-Sent-Events quiz broadcast channel, an optional RabbitMQ publisher and an optional MongoDB audit log. Packaged as a container image and run as a pod behind the preview router.

## Files
| Path | Role |
|---|---|
| services/api/src/server.js | The service proper: env config, `initDb`, `initCache` with `cacheGet`/`cacheSet`/`cacheDrop`, the `health` handler, the `apiRoutes` plugin (tasks / share / quiz), `findTask`, `QUIZZES`, `quizClients`, and the `start` sequence with its `boot` summary |
| services/api/src/queue.js | Optional RabbitMQ publisher: `initQueue` (answers whether the publisher came up), `publish`, `queueName`, and `connectOptions` (explicit PLAIN credentials from `RABBITMQ_PASSWORD`) |
| services/api/src/audit.js | Optional MongoDB audit log: the `AuditEvent` mongoose model, `initAudit` (answers `ready`), `recordEvent`, `auditCollection` |
| services/api/package.json | Name `orbit-api`, ESM (`"type": "module"`), `engines.node >= 20`, deps `fastify`/`pg`/`redis`/`amqplib`/`mongoose`, `start` → `node src/server.js` |
| services/api/Dockerfile | `node:20-alpine`, `npm ci --omit=dev` from the copied manifests, `ENV PORT=8083`, `CMD ["node", "src/server.js"]` |
| services/api/.dockerignore | Keeps `node_modules`, `npm-debug.log`, `.git` out of the build context |
| services/api/.gitignore | Ignores `node_modules/` and re-includes the lockfile with `!package-lock.json` |
| services/api/.infrar/build.yaml | Infrar build spec: `dockerfile`, the `requires:` entries (`db`, `cache`, `queue`, `auth`, `db-mongodb`) and the `env:` list |
| services/api/.infrar/iac-preview/api-pod.yaml | The pod manifest — the sole statement of how the node runs: `containerPort: 8083` and the `/health` readiness probe |
| services/api/README.md | Short node readme; stale — it still lists the routes at the root, before the `/api` prefix move, and mentions only `DATABASE_URL` |

## Surface
**Exposes** — listens on `0.0.0.0:${PORT}` (default `8083`). Unprefixed `GET /health` (kept for the pod readiness probe, which hits the container path directly). Under the `/api` base, from the `apiRoutes` plugin registered with `{ prefix: '/api' }`: `GET /api/health` → `{ status, storage }`; `GET /api/tasks` (cached); `POST /api/tasks` `{ title, priority? }` → 201; `POST /api/tasks/:id/share` `{ email }`; `GET /api/quiz/stream` (SSE, `event: quiz`); `POST /api/quiz/broadcast` `{ question?, options?, answer? }` → `{ delivered, quiz }`. Command: `npm start`. `build.yaml` omits `run.api_prefix`, i.e. the `/api` default. Module API: `queue.js` exports `initQueue`/`publish`/`queueName`, `initQueue` resolving to `true` only when the channel was asserted; `audit.js` exports `initAudit`/`recordEvent`/`auditCollection`, `initAudit` resolving to the `ready` flag. Both flags exist so `start()` can state the boot shape in one line without reaching into either module's state.

**Consumes** — env read by the code: `PORT` (default `8083`), `DATABASE_URL` (the `db` requirement, postgres), `REDIS_URL` (the `cache` requirement, redis), `RABBITMQ_URL` (the `queue` requirement, rabbitmq), `RABBITMQ_PASSWORD` and `TASKS_QUEUE` (default `orbit.tasks`), `MONGODB_URL` (the `db-mongodb` requirement, mongodb), `MAIL_API_KEY` (`secret: true`, Resend API key), `MAIL_FROM` (default `orbit@mail.infrar.io`). Declared but read nowhere: `KEYCLOAK_URL` (the `auth` requirement). Packages: `fastify`, `pg`, `redis` (node-redis v6), `amqplib`, `mongoose`. Services: Postgres, Redis, RabbitMQ, MongoDB, and the Resend REST API (`POST https://api.resend.com/emails`) over Node 20's global `fetch`.

## Behavior
`start()` records `bootStartedAt`, runs `initDb()`, `initCache()`, `initQueue(app.log)`, `initAudit(app.log)`, then `app.listen({ port: PORT, host: '0.0.0.0' })`. Every initialiser is failure-tolerant by design: a missing or unreachable dependency is logged and the node still boots.

Startup logging is symmetric — each optional dependency reports its outcome whichever way it goes: `postgres store ready` (carrying `seeded`, true only on a first boot against an empty table) or the `DATABASE_URL not set` warning; `redis cache ready` or its fallback warning; `rabbitmq publisher ready` / `audit log ready` or their "disabled" warnings. Once the port is open, a single structured `orbit-api ready` line carries the whole boot shape: `port`, `storage` (`postgres`|`memory`), `cache` (`redis`|`memory`), `queue` (the queue name|`disabled`), `audit` (the collection|`disabled`), `mail` (`resend`|`disabled`) and `bootMs`. That same `boot` object is the payload of the one `api.started` audit event, written after `listen()` so it records a service that is actually serving. A boot that throws logs `orbit-api failed to start` with the error and `bootMs`, then exits 1.

`initDb` leaves `pool` null when `DATABASE_URL` is unset — reads and writes then fall back to the module-level `memory` array with `nextId`. With a URL it opens a `pg.Pool`, creates the `tasks` table if missing (`id serial`, `title`, `priority` default `medium`, `done` default false), seeds two sample rows when empty and logs `postgres store ready`.

`initCache` mirrors that shape: without `REDIS_URL` it warns and leaves `redis` null, so `cacheGet`/`cacheSet`/`cacheDrop` work on the process-local `memoryCache` map (entries carry an `expiresAt` checked on read). With a URL it opens a node-redis client, registers an `error` logger, connects and logs `redis cache ready`; a connect failure is caught, leaving the node on the in-memory map. Every cache call is wrapped so a Redis error degrades to a miss rather than a 500. `GET /api/tasks` returns the cached list when present, otherwise reads Postgres (or `memory`) and stores it under `tasks:all` for `TASKS_CACHE_TTL` (30s); `POST /api/tasks` calls `cacheDrop` after inserting, in both branches.

`initQueue` opens one connection and one channel and asserts the durable `TASKS_QUEUE`, registering `error`/`close` handlers (an unhandled `error` event on either EventEmitter would take the process down); `close` resets `channel` to null. It answers `true` only on the path that sets `channel`, and `false` both when `RABBITMQ_URL` is unset and when the broker is unreachable. `connectOptions` only intervenes when `RABBITMQ_PASSWORD` is set and the URL carries no password: it then sends PLAIN credentials with the URL's username, or `guest` when there is none — because amqplib's `credentials` option replaces the URL userinfo wholesale. A password in the URL always wins. `publish()` returns false when `channel` is null or the write throws.

`initAudit` registers `error`/`disconnected`/`connected` handlers on the default mongoose connection and connects with `serverSelectionTimeoutMS: 5000` — short on purpose, since `initAudit` is awaited before `listen()` and the 30s default would hold the port shut on every boot. It answers the same `ready` flag it sets. `recordEvent` is gated on `ready`: mongoose buffers a write issued with no connection and rejects it ~10s later, so the gate turns that into an immediate no-op.

`health` reports `storage: 'postgres'` when `pool` is set and `'memory'` otherwise — the orbit-web header chip reads that field. It is mounted twice: bare `/health` for the probe and `/api/health` inside the plugin.

`POST /api/tasks` rejects a missing `title` with 400. `POST /api/tasks/:id/share` validates the id as an integer and the recipient against `EMAIL_RE` (400), answers 503 while `MAIL_API_KEY` is unset, resolves the task via `findTask` (404 when absent), then POSTs a plain-text email to Resend with `Authorization: Bearer`. An unreachable provider or a non-2xx reply becomes 502 carrying `providerStatus`/`providerMessage`; both are logged with the task id.

`GET /api/quiz/stream` hijacks the reply, writes the SSE headers itself, adds the raw response to `quizClients`, sends `: connected`, pings `: ping` every 25s, and clears both the interval and the set entry on close. `POST /api/quiz/broadcast` uses the posted quiz when `question` is present (400 unless `options` is an array of ≥2), otherwise picks one of the built-in `QUIZZES`, and writes an `event: quiz` frame to every connected client.

## Notes
- **The `orbit-api ready` summary reads LIVE state, never the environment** — `pool`, `redis`, and the flags `initQueue`/`initAudit` answer. That is the point of it: a dependency that was wired but is unreachable must read `memory`/`disabled`, not echo back the URL that was injected. Any new optional dependency adds a field the same way, and its initialiser must answer a boolean rather than expose its internals.
- **`DATABASE_URL` is projected once, by `requires.db` (postgres, `url`)**, and `requires.db-mongodb` projects `MONGODB_URL` only. The collision it used to carry is gone: two requirements projecting one variable name let a Mongo connection string reach `pg.Pool`, which breaks every task route. Never project `DATABASE_URL` from anything but `db`.
- **`RABBITMQ_PASSWORD` and `TASKS_QUEUE` are both declared**: the first as `requires.queue.env` (`password`), the second in `env:` with `default: "orbit.tasks"`, the value `queue.js` carries. Keep them there — an env the code reads and the spec omits is never injected and fails silently.
- **`requires.auth` (keycloak, `KEYCLOAK_URL`) has no consumer**: no source file reads it and no OIDC client is installed. It binds a resource the code never contacts — a declaration ahead of its consumer, not a live dependency.
- **`publish()` is never called.** `server.js` imports `initQueue` and `queueName` only, so the broker connects and asserts the queue but nothing is ever published. Wiring a task event is the missing half of that feature.
- The `/api` prefix is the contract with the preview router, which forwards `/api/*` from the web origin **without stripping it**. Moving routes to the root, or setting `run.api_prefix`, breaks every frontend call (404). Keep the plugin at `/api`, keep the bare `/health`, and keep the probe path in the pod manifest equal to that unprefixed route.
- Bind stays `0.0.0.0`; the platform reaches the pod over the network, never localhost.
- Every dependency is optional in code but none carries `optional: true` in `build.yaml`, so an unbound requirement still blocks a launch. No code path may assume a dependency is up: an outage must stay a cache miss / a false from `publish` / a false from `recordEvent`.
- `requires.cache` asks for `tenancy: db-index` because the cache key `tasks:all` is a constant: two previews sharing one Redis without a unit would overwrite each other's task list. node-redis honours the `/N` a `redis://host:port/N` URL carries.
- Cache invalidation only covers `POST /api/tasks`. Rows changed directly in Postgres stay stale for up to 30s, and `memoryCache` is per-process, so two replicas hold independent copies. Any new task-mutating route must call `cacheDrop(TASKS_CACHE_KEY)`.
- node-redis v6 takes the TTL as `{ expiration: { type: 'EX', value } }`; the flat `{ EX: n }` form is deprecated.
- `memory`, `nextId`, `memoryCache`, `quizClients`, `channel` and the mongoose `ready` flag are per-process: they reset on restart, and a broadcast only reaches clients attached to the same pod instance.
- Adding, removing or re-versioning a `requires:` entry must update `.infrar/environment/resources.tf` (and `outputs.tf`) at the repo root in the same commit — one `module` per requirement key, currently `db`, `cache`, `queue`, `auth`, `db-mongodb`.
- `npm ci` fails on a lockfile out of sync with `package.json`, so refresh `package-lock.json` with any dependency change. Never drop the `!package-lock.json` negation in `services/api/.gitignore`: without it the lockfile leaves the build context and the Dockerfile `COPY` fails.
- The base image must be a tag that exists — it was once pinned to `node:20.99.99-alpine` and every build failed; it is `node:20-alpine`.
- Mail is HTTPS-only by design: SMTP ports are blocked in preview, so do not introduce nodemailer or any SMTP client. Node 20 is required for the global `fetch`.
- The pod manifest is the only statement of port, command, probe and writable mounts; the legacy `strategy:`, `run.port:` and `healthcheck:` keys still sitting in `build.yaml` are ignored while it exists and are stripped by the next launch — change the manifest, not the spec.
