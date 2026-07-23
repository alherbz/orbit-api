# orbit-api

Task API for the Orbit demo project. Fastify + Postgres.

- `GET /health` — liveness
- `GET /tasks` — list tasks
- `POST /tasks` — create a task `{ title, priority }`

Reads `DATABASE_URL` (Postgres). Without it, serves an in-memory store so the
service is always runnable. Listens on `PORT` (default `8080`).
