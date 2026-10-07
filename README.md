# orbit-api

Backend for **Orbit**, a small team task board. Paired with the `orbit-web`
repository (the frontend), which forwards `/api/*` here.

| Path | What |
|------|------|
| `services/api` | Fastify API (Node 20): tasks, activity feed, file attachments, signed public links |
| `services/worker` | Queue consumer: turns task events into the activity feed |
| `deploy` | Terraform: Postgres, Redis, S3 bucket |

## Dependencies

- **Postgres 16** — tasks, activity, attachment metadata. Schema via migrations.
- **Redis 7** — the task-list cache and the `task-events` queue (BullMQ) between API and worker.
- **S3-compatible storage** — attachment files. The bucket must exist before the API starts
  serving uploads; the API never creates it.

## Configuration

API (`services/api`):

| Variable | Required | Meaning |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres connection string |
| `REDIS_URL` | yes | e.g. `redis://localhost:6379` |
| `S3_ENDPOINT` | yes | e.g. `http://localhost:9000` |
| `S3_BUCKET` | yes | attachments bucket |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | yes | storage credentials |
| `S3_REGION` | no | default `us-east-1` |
| `ORBIT_SIGNING_SECRET` | yes | HMAC secret for public task links — any long random string |
| `MAIL_API_KEY` | no | Resend key; task sharing by email answers 503 without it |
| `PORT` | no | default `8083` |

Worker (`services/worker`): `DATABASE_URL`, `REDIS_URL`.

The API exits at start when a required variable is missing. `GET /health` answers 200 only
when Postgres is migrated and Redis and the bucket are reachable (503 with the detail otherwise).

## Database

Migrations are **not** applied at start. Before the first start, and after pulling new
migrations:

```sh
cd services/api
npm run migrate   # applies migrations/*.sql once each
npm run seed      # demo tasks, only on an empty database
```

## Local run

`docker compose up --build` starts Postgres, Redis, MinIO (with the bucket created), the API
and the worker; then run the migrations as above against `localhost:5432`, or
`docker compose run --rm api npm run migrate && docker compose run --rm api npm run seed`.
The API listens on `http://localhost:8083`.
