---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: test/prv-p4-drift
previous_commit: 2b62829573111a14ae62059333641e4bdb3668a4
---

## What changed

- `services/api/package.json`: new dependency `amqplib` (`^2.0.1`), the AMQP 0-9-1 client
  for RabbitMQ. `package-lock.json` refreshed to match — amqplib 2.0.1 has no transitive
  dependencies.
- `services/api/src/queue.js` (new): the queue publisher. `initQueue(logger)` reads
  `RABBITMQ_URL` from `process.env`, connects with amqplib's promise API, creates one
  channel and asserts the durable queue named by `TASKS_QUEUE` (default `orbit.tasks`).
  `publish(message, queue?)` sends a persistent JSON message and returns false when the
  broker is not connected.
- `services/api/src/server.js`: imports `initQueue` and calls it in `start()`, after
  `initDb()` and `initCache()`.

Nothing else changed. The Infrar build spec, the environment declarations, the pod
manifest and the node knowledge file were left untouched on the author's instruction, so
they do not yet mention this dependency.

## Why

The api node needs to hand work off to a broker, and RabbitMQ is the broker chosen for it.
The publisher is deliberately the smallest thing that can do that: one module, one
connection, one channel, no queue topology beyond the durable queue it writes to.

It follows the degradation the node already applies to Postgres and Redis — an absent or
unreachable dependency is logged and the service still starts. That keeps the node runnable
wherever `RABBITMQ_URL` is not set, which today includes the preview, since the build spec
does not declare the requirement that would inject it. Both EventEmitters amqplib hands
back (the connection and the channel) get an `error` listener, because an unhandled `error`
event on either would otherwise terminate the process.

`publish()` has no call site yet: this change introduces the capability, it does not decide
which events the api emits.
