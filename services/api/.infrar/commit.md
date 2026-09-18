---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: test/prv-p4-drift
previous_commit: de73c6c5774148af5e6c4d553fed9389208d2235
---

## What changed

`services/api/src/server.js`:
- `initDb` logs `postgres store ready` with `seeded` (true only when it just
  inserted the two sample rows) on the path that sets `pool`.
- `initCache` logs `redis cache ready` right after `client.connect()` succeeds.
- `start()` records `bootStartedAt`, keeps the same init order, and after
  `app.listen()` builds a single `boot` object — `port`, `storage`
  (`postgres`/`memory`), `cache` (`redis`/`memory`), `queue` (the queue name or
  `disabled`), `audit` (the collection or `disabled`), `mail`
  (`resend`/`disabled`), `bootMs` — logged as `orbit-api ready`. Every field is
  read from live state (`pool`, `redis`, the flags the initialisers answer),
  never from the environment.
- That same object replaces `{ port, storage }` as the payload of the one
  `api.started` audit event.
- The failure path logs `{ err, bootMs }` with the message
  `orbit-api failed to start` instead of `app.log.error(err)`.
- Imports `queueName` from `./queue.js` and `auditCollection` from `./audit.js`
  for the summary.

`services/api/src/queue.js`: `initQueue` returns `true` only after the channel is
asserted, and `false` both when `RABBITMQ_URL` is unset and when the broker is
unreachable. No change to connection handling, `connectOptions` or `publish`.

`services/api/src/audit.js`: `initAudit` returns the `ready` flag it already
sets — `false` when `MONGODB_URL` is unset or the connect fails, `true` on
success. No change to the handlers, the timeout or `recordEvent`.

`services/api/.infrar/build.yaml` and the pod manifest are untouched: the port,
the start command, the readiness probe and the set of environment variables the
code reads are all unchanged, so neither file states anything that moved.

## Why

The startup logs were asymmetric: each optional dependency warned when it was
missing but said nothing when it came up, so a boot on a fully wired preview
produced only Fastify's `Server listening` line and left the operating shape —
Postgres or the in-memory array, Redis or the local map, publisher and audit log
on or off — to be inferred from the absence of warnings. Inference from silence
breaks exactly when it matters, because a dependency that is wired but
unreachable also falls back quietly.

One structured line at the end of the boot answers that in a single read, and
reading it from live state rather than from the environment is what makes it
trustworthy: it reports what the process is actually using, not what was
injected. `bootMs` puts a number on the startup cost the awaited initialisers
add, and the same object on the `api.started` audit event means the recorded
history of boots carries the same facts as the log.

The two booleans are the minimum needed to say this from one place: `queue.js`
and `audit.js` already track their own readiness, they simply had no way to
report it back to the caller.
