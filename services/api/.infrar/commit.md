---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: test/prv-p1-env
previous_commit: 62141a8d72553d2e205e256f04202c72a0720b28
---

## What changed

- `.infrar/build.yaml`: new `requires.cache` entry — product `redis`,
  `version: ">=6"`, projecting `REDIS_URL: url` into the pod. No
  tenancy is stated, so the product default applies.
- `src/server.js`: reads `REDIS_URL` and adds a small cache layer —
  `initCache()` (called from `start()` after `initDb()`) opens a
  node-redis client when the variable is set, and `cacheGet`,
  `cacheSet`, `cacheDrop` fall back to a process-local `memoryCache`
  map with per-entry expiry when it is not. `GET /api/tasks` now serves
  from the `tasks:all` key (30s TTL) on a hit and populates it on a
  miss; `POST /api/tasks` drops the key in both storage branches.
- `package.json` / `package-lock.json`: `redis` ^6.2.1 added, lockfile
  refreshed so the Dockerfile's `npm ci --omit=dev` stays satisfiable.
- `/.infrar/environment/`: `resources.tf` gains `module "cache"`
  (`source = "infrar/redis"`, `product_version = ">=6"`) and
  `outputs.tf` the matching sensitive output, so the repository's
  declarations match the new `requires:` entry.
- `.infrar/knowledge.md`: rewritten for the cache layer, its
  dependency and its invalidation rules.

## Why

The task list is read on every board render and served from the same
Postgres round-trip each time; a cache in front of it is the cheap fix,
and the platform can only stand one up if the node declares it — an
undeclared dependency is never provisioned and `REDIS_URL` would stay
unset.

The fallback keeps that dependency non-fatal, matching how the node
already treats Postgres: a missing or unreachable Redis logs and
degrades to the in-memory map instead of failing the boot, and every
cache call is guarded so a runtime Redis error becomes a miss rather
than a 500 on `GET /api/tasks`. Both paths were exercised against a
local redis and with the variable unset.
