---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: test/prv-p1-env
previous_commit: 8308bf8916e4ad7eff9f5a109735f7c9f62985ba
---

## What changed

- `.infrar/build.yaml`: `requires.cache` gains `tenancy: db-index`. Product and version
  are unchanged.
- `.infrar/environment/resources.tf` (repository root): `module "cache"` gains the
  matching `tenancy = ["db-index"]`.
- `.infrar/knowledge.md`: a note recording the unit and why it is that one.

No application code changed.

## Why

The `cache` requirement named a product and a version but no unit, so it asked for a Redis
without saying which part of one it wanted. The cache key is the constant `tasks:all` in
`src/server.js`, so two previews bound to one shared instance would overwrite each other's
task list and each would serve the other's data for up to the 30s TTL.

A db index is the unit that fixes this with no change to the application: node-redis
honours the index carried by a `redis://host:port/N` URL, so the code goes on reading one
`REDIS_URL` and using one key name. The alternative unit, a key prefix, would have meant
the application reading a prefix variable it does not have — adapting the app to the
platform, which is the wrong direction.
