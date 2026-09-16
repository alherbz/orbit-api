---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: test/prv-p4-drift
previous_commit: 69012894cdf704d1656f024798921ac91b7483d1
---

## What changed

- **`src/audit.js` (new)** — the audit log. `initAudit(logger)` reads `MONGODB_URL`
  from `process.env` and opens the default mongoose connection with
  `serverSelectionTimeoutMS: 5000`; it registers `error`, `disconnected` and
  `connected` handlers on the connection and never throws. `recordEvent(name, payload)`
  writes one document (`name`, `payload`, `at`) to the `audit_events` collection
  through the `AuditEvent` model and returns `true`/`false`.
- **`src/server.js`** — imports `initAudit`/`recordEvent`, calls `initAudit(app.log)`
  in `start()` after `initQueue`, and records a single `api.started` event
  (`port`, `storage`) after `app.listen()` succeeds.
- **`package.json` / `package-lock.json`** — dependency `mongoose` `^9.10.1`
  (resolved 9.10.1, which pulls the `mongodb` 7.x driver and six other packages).
  The lockfile was regenerated because the Dockerfile builds with `npm ci`.

## Why

The node needed an audit trail of what it does, kept outside the task store.

The module follows the shape the rest of this service already uses for an
external dependency — `initDb`, `initCache`, `initQueue`: absent or unreachable
infrastructure degrades to a no-op and never keeps the API from booting. Two
mongoose defaults work against that and are handled explicitly:

- **Server selection defaults to 30s** (`mongodb/lib/connection_string.js`).
  Since `initAudit` is awaited before `app.listen()`, an unreachable Mongo would
  hold the port shut for 30 seconds every boot; the cap brings that to 5s.
- **`bufferCommands` defaults to true**, so a write issued with no connection
  does not fail — it buffers and rejects after `bufferTimeoutMS` (10s, measured).
  `recordEvent` therefore gates on an explicit ready flag, which is what makes a
  disabled audit log cost nothing per call instead of a timeout.

`recordEvent` is called once per boot and has no other callers yet: which
domain events the API audits is a product decision, not part of wiring the
module in.
