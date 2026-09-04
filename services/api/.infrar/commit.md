---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: develop
previous_commit: c024dec79c8b52c513c4d252f13c5b04fec12c0e
---

## What changed

- `src/server.js`: all application routes are now registered inside an
  encapsulated Fastify plugin mounted with `{ prefix: '/api' }`, so the
  service serves `GET /api/health`, `GET/POST /api/tasks`,
  `POST /api/tasks/:id/share`, `GET /api/quiz/stream` and
  `POST /api/quiz/broadcast`. Route handlers, validation, storage and
  mail logic are unchanged — only where the routes are mounted moved.
- A bare `GET /health` (same handler as `/api/health`) remains at the
  root for the pod's own container healthcheck, which probes the path
  declared in `.infrar/build.yaml` (`/health`) directly, not through the
  preview router.
- `.infrar/knowledge.md`: Behavior section rewritten to document the
  `/api` base path and the extra unprefixed health route.

## Why

The preview routing convention forwards `/api/*` from the web origin to
this service without stripping the prefix. With routes served at the
root, every frontend call (`/api/tasks`, `/api/health`,
`/api/tasks/:id/share`) reached the service with the `/api` prefix still
present and answered 404. Serving under `/api` matches what the frontend
already requests; no frontend, port, proxy or build-spec change is
needed (`run.api_prefix` is omitted, which already means the `/api`
default, and the healthcheck path `/health` still matches the kept
unprefixed route).
