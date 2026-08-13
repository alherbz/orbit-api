---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: develop
previous_commit: 08169baeb42581511ee33d5b87f7621171f63818
---

## What changed
In `.infrar/build.yaml`, the `DATABASE_URL` env entry was changed from `secret: true` to `from: deploy`. The knowledge file's Dependencies section was updated to describe the new wiring. No application code was touched.

## Why
`DATABASE_URL` is not a per-preview secret: it is a graph-wired value produced by the database (deploy) node. Declaring it with `from: deploy` lets the preview inject the synthesized Postgres URL automatically, so the API uses Postgres in previews instead of silently falling back to the in-memory store.
