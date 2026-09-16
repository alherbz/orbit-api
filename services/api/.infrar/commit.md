---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: test/prv-p4-drift
previous_commit: 6045cd91c2275947b379d625069c825a5227ffea
---

## What changed

`services/api/.infrar/build.yaml`, `requires.db-mongodb.env`: `DATABASE_URL: url` removed.
The entry now projects `MONGODB_URL: url` only. Nothing else in `requires:` changed —
`db` (postgres `>=15 <17`, `database`), `cache` (redis `>=6`, `db-index`),
`queue` (rabbitmq `>=4.1`, `vhost`, `RABBITMQ_URL` + `RABBITMQ_PASSWORD`),
`auth` (keycloak `26.3`, `KEYCLOAK_URL`) and `db-mongodb` (mongodb `>=4.4`, `database`)
keep their product, version range, tenancy and projections.

`.infrar/environment/`: unchanged and verified. The requirement set is the same five keys,
so `resources.tf` already carries one `module` per key with the same `product_version` and
`tenancy`, `outputs.tf` one sensitive output per module, and `versions.tf` Infrar's stamp.

`services/api/.infrar/knowledge.md`, two Notes bullets that the spec on disk falsified:
`DATABASE_URL` is no longer described as projected twice, and `RABBITMQ_PASSWORD` /
`TASKS_QUEUE` are no longer described as undeclared — both have been declared since 6045cd9.

## Why

`DATABASE_URL` was projected by two requirements at once, postgres and mongodb. Only one
value can reach the pod, so whichever requirement loses hands its consumer an address for
the other engine: a Mongo connection string reaching `pg.Pool` in `src/server.js` fails
every task route. That is a defect, not a preference. The message of 6045cd9 states the
removal as done, but the committed file still carried the line — this commit makes the
spec match what was already claimed of it.

The coherence gate compared each declaration with the client that actually speaks to it.
`pg` 8.22.0 and the SQL in `initDb` (`SERIAL`, `CREATE TABLE IF NOT EXISTS`, `::int`,
`RETURNING`) are satisfied by every version in `>=15 <17`, the range that also contains the
Postgres 16 engine `deploy/main.tf` provisions. `amqplib` 2.0.1 states compatibility with
RabbitMQ 4.1.0 and later, matching `>=4.1`. The `mongodb` driver 7.6.0 pulled in by mongoose
9.10.1 states it supports 4.4+ servers, matching `>=4.4`. `redis` `>=6` is the one range the
code contradicts — node-redis 6.2.1 supports Redis 7.2, 7.4 and 8.0 and marks `< 7.2`
unsupported — and it is reported rather than re-versioned here, because picking a version
for a member is not this change's call.
