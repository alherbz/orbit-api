---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: test/prv-p3-catchup
previous_commit: bdd06607de113668c1ba7f5209690023c57d72b3
---

## What changed

- `.infrar/build.yaml`, `requires.cache`: `version` `">=6"` → `">=7.2 <8"`,
  and `tenancy: db-index` stated where none was. The old range was the npm
  client version (`redis` `^6.2.1` in `package.json`) written into the
  product field; it is the Redis *server* that is being declared, and
  node-redis 6.2.1 marks servers `< 7.2` unsupported. The new range is
  covered end to end by what the catalog has run (7.2, 7.4).
- `.infrar/build.yaml`, `requires.mail`: removed. It required product
  `mailpit` projecting `SMTP_URL`, and `src/server.js` reads no such
  variable — sharing posts to the Resend REST API over HTTPS with
  `MAIL_API_KEY`, which is already declared as an `env:` secret. No
  `module "mail"` ever existed under `.infrar/environment/`, so the entry
  was never provisioned either.
- `requires.db` is unchanged (`postgres`, `">=15 <17"`, `tenancy: database`):
  the coherence gate found nothing against it.
- `.infrar/environment/resources.tf`: `module "cache"` follows the
  requirement — `product_version = ">=7.2 <8"`, `tenancy = ["db-index"]`.
  `module "db"` unchanged. The two modules are exactly the two `requires:`
  entries; `outputs.tf` and `versions.tf` already matched and are untouched.
- `.infrar/knowledge.md`: the statements this change falsified — the
  `mail`/`SMTP_URL` requirement, the `>=6` range, and the note about `mail`
  lacking a module — corrected, plus the client/server version coupling and
  the reason `db-index` is load-bearing.

## Why

A requirement is what the platform provisions and wires, so it has to say
what the code actually speaks to, at a version the code actually supports.
Two entries did not.

`">=6"` admitted Redis 6.x, which the pinned client refuses and which has
never run here; `>=7.2 <8` is the range the client documents as supported
and the catalog has served.

`tenancy` was absent while the node writes a single unprefixed key,
`tasks:all`. Under `none` two previews on one instance overwrite each
other's task list; under `acl-prefix` the write is refused and
`cacheSet`'s try/catch turns that into a permanent, silent cache miss.
`db-index` isolates inside the `REDIS_URL` the code already passes whole
to `createClient`, with no change to the application.

The `mail` requirement asked the platform to stand up a mail sink that no
line of the service connects to. Making it real would have meant rewriting
the share path onto SMTP — a change to the application, which this change
is not, and which the code comment there argues against anyway. Dropping
it leaves the declarations describing the software as written.
