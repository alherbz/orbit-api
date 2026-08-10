---
schema_version: 1
id: 8ed247c7-af49-4d49-a5da-6160ce873529
name: api
node: services/api
branch: develop
previous_commit: 568f32dfb6ef50ba8c7be7900ae05239de734eab
---

## What changed
- `services/api/src/server.js`: added a quiz broadcast API on top of the existing Fastify server:
  - `GET /quiz/stream` — Server-Sent Events endpoint; each connected client is tracked in an in-process set, kept alive with a 25s comment heartbeat, and removed when the connection closes.
  - `POST /quiz/broadcast` — sends a quiz as an SSE `quiz` event to every connected client. Accepts an optional `{question, options, answer}` body (validating that `options` has at least 2 choices) and otherwise picks a random quiz from a small built-in list; responds with the quiz and the number of clients it was delivered to.
- `services/api/.infrar/knowledge.md`: updated to document the new endpoints and the per-process nature of the SSE client set.

The requested `GET /health` endpoint already existed and returns 200 — no change was needed for it.

## Why
The user asked for an API that broadcasts a little quiz to every connected user. SSE was chosen over WebSockets because it needs no new dependency, works from a plain browser `EventSource`, and fits the existing single-file Fastify setup. No build.yaml change: the service still builds, starts, and listens exactly as before (port 8083, same command, no new dependencies).
