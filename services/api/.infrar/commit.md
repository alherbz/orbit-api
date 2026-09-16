---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: test/prv-p4-drift
previous_commit: 866b1c9b8f01507f4436427c557ba358f35c80ba
---

## What changed

`services/api/.infrar/build.yaml`, `requires:`:

- `queue` (rabbitmq) gained `version: ">=4.1"` — amqplib's own README states that from
  `0.10.7` on it is compatible with RabbitMQ 4.1.0 and later, and the node runs `2.0.1` —
  `tenancy: vhost`, and `RABBITMQ_PASSWORD: password` in its `env:`. The code has read
  `RABBITMQ_PASSWORD` since the credentials change; nothing projected it, so the branch
  that sends explicit PLAIN credentials could never fire in a Preview.
- `db-mongodb` (mongodb) gained `version: ">=4.4"` — the installed driver (`mongodb`
  7.6.0, via mongoose 9.10.1) states "the driver currently supports 4.4+ servers" — and
  `tenancy: database`. Its `DATABASE_URL: url` projection was **removed**: the same
  variable is projected by `requires.db` (postgres), only one value can reach the pod, and
  a Mongo connection string handed to `pg.Pool` breaks every task route.
- `env:` gained `TASKS_QUEUE` with `default: "orbit.tasks"`, the value `queue.js` carries.

`.infrar/environment/resources.tf`: `module "queue"` and `module "db-mongodb"` carry the
same `product_version` and `tenancy` as the entries above.

Unchanged and deliberately so: `db` (postgres `>=15 <17`, matching the Postgres 16 engine
`deploy/main.tf` provisions), `cache` (redis `>=6`), and `auth` (keycloak `26.3`), which
still has no consumer anywhere in `services/api/src`.

## Why

The node's `requires:` named its products but not the versions the code was written
against, and left two variables the code reads unprojected. Both version ranges here are
read from the installed drivers rather than chosen, and the tenancy of each entry is the
unit that connection actually needs — a vhost for the queue, a database for Mongo.

The removed `DATABASE_URL` was the one outright defect: two requirements projecting one
variable name is not a preference, it is a value that arrives wrong for whichever consumer
loses.
