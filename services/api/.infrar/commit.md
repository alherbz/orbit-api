---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: test/prv-p4-drift
previous_commit: 96f0dd55ba83ce850d8a1d39a5a2da285c5382ae
---

## What changed

`services/api/src/queue.js` now reads `RABBITMQ_PASSWORD` from `process.env`
alongside `RABBITMQ_URL`, and imports `credentials` from `amqplib` next to
`connect`.

A new internal helper, `connectOptions(url)`, decides whether to hand amqplib
explicit credentials:

- `RABBITMQ_PASSWORD` unset, or `RABBITMQ_URL` unparseable, or the URL already
  carrying a password → no options are passed, so the connection is opened
  exactly as before.
- the URL carries no password → `{ credentials: credentials.plain(user,
  RABBITMQ_PASSWORD) }`, where `user` is the URL's percent-decoded username, or
  `guest` when the URL has no userinfo at all.

`initQueue` passes the result as the second argument of `connect`. Nothing else
changed: the queue name, the durable `assertQueue`, the error/close handlers,
`publish` and the optional-broker degradation are untouched.

## Why

`RABBITMQ_URL` is an address, and a broker credential does not always travel
inside it — a deployment that injects the secret separately would otherwise
authenticate with an empty password, because amqplib derives PLAIN credentials
from the URL userinfo and treats a missing password as `''`.

The username has to accompany the password because amqplib's
`socketOptions.credentials` replaces the URL's userinfo wholesale rather than
merging with it (`lib/connect.js`: `sockopts.credentials ||
credentialsFromUrl(parts)`); `guest` is the same default amqplib itself applies
to a URL with no userinfo.
