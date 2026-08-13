---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: develop
previous_commit: 1824d58b1a075a29068dfc6d4fb8da6ff197ba38
---

## What changed
- `src/server.js`: added `POST /tasks/:id/share` accepting `{ "email": "..." }`. It validates the recipient (400 on a malformed address), returns 503 with a clear message when `MAIL_API_KEY` is unset, looks the task up through a new `findTask(id)` helper (Postgres when `DATABASE_URL` is set, the in-memory store otherwise, 404 when missing), and sends a plain-text email through the Resend HTTPS API (`POST https://api.resend.com/emails` with a Bearer key) containing the task title, priority and status. Provider failures return 502 and surface the provider's HTTP status and message in the response body; both success and failure are logged with the provider details so a failed send is diagnosable from the preview logs. The sender address comes from `MAIL_FROM` (default `orbit@mail.infrar.io`); nothing is hardcoded.
- `.infrar/build.yaml`: declared `MAIL_API_KEY` (`secret: true`) and `MAIL_FROM` (default `orbit@mail.infrar.io`) in the env list so the preview can inject them.

## Why
Users want to share a task with a teammate by email from the Orbit board. The preview environment blocks SMTP ports, so the send goes over plain HTTPS via Resend using Node 20's global `fetch` — no new dependency. The API stays fully runnable without mail credentials: startup is unchanged and only the share endpoint degrades (503) until `MAIL_API_KEY` is configured.
