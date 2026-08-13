---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: develop
previous_commit: 060c7b181f82765fdc1502f25106807c3bd17c9b
---

## What changed

In `services/api/.infrar/build.yaml`, the `DATABASE_URL` env entry now reads
`from: orbit` instead of `from: deploy`. No application code changed.

## Why

The `from:` value must name the node as the project graph knows it. The
database is the `orbit` Postgres node extracted from the Terraform, not the
`deploy` IaC root, so `from: deploy` matched no link and the preview never
injected the synthesized Postgres URL. Wiring from `orbit` lets the preview
inject `DATABASE_URL` correctly.
