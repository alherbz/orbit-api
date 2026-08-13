Add POST /tasks/:id/share to send a task by email via Resend

The endpoint looks the task up (Postgres when DATABASE_URL is set, the
in-memory store otherwise) and sends a plain-text email through the
Resend HTTPS API with the task title, priority and status. Configuration
comes from MAIL_API_KEY (secret) and MAIL_FROM (default
orbit@mail.infrar.io), both declared in the node's build.yaml. Without
MAIL_API_KEY the API still starts and the endpoint answers 503; a
malformed recipient returns 400; provider failures return 502 with the
provider's status and message, which are also logged.
