---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: develop
previous_commit: dc4ab151203ff04fe87a74b97dd311bec2c1bfc2
---

## What changed
GET /health in src/server.js now returns the storage mode alongside the status: `{ "status": "ok", "storage": "postgres" }` when the Postgres pool is connected (DATABASE_URL set and initDb succeeded), `"storage": "memory"` when the API runs on the in-memory fallback. The node's knowledge.md Behavior section was updated accordingly. No other route, dependency, port or build-spec change.

## Why
The redesigned orbit-web header shows a compact status chip indicating whether the API is reachable and which storage backs the board; it polls /api/health once at load and needs the storage word in the payload to render it.
