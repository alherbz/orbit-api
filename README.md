# orbit-api

Backend monorepo for the **Orbit** demo project. Two Infrar nodes:

- `services/api` — **app** node. Fastify task API (Node 20), reads `DATABASE_URL`.
- `deploy` — **iac** node. Terraform root provisioning managed Postgres.

Paired with the `orbit-web` repository (the frontend).
