---
schema_version: 1
id: 15862494-86f1-4d79-8a14-3c7bda3fba4c
name: orbit-api
node: services/api
branch: develop
previous_commit: 86f7cea53d5b289e9ae32057df1f622867c1c81c
---

## What changed

- `src/server.js`: the default listening port is now `8083` instead of `8080`
  (`process.env.PORT || 8083`). The bind host stays `0.0.0.0`, so the pod is
  reachable from outside the container.
- `Dockerfile`: `ENV PORT=8083` and `EXPOSE 8083`.
- `README.md`: documents the new default port.
- Added `.infrar/build.yaml` for this app node (it was missing): dockerfile
  strategy using the existing `services/api/Dockerfile`, serving port `8083`,
  healthcheck on `GET /health`, and the `PORT` / `DATABASE_URL` env vars.

## Why

The service had to listen on port 8083. The port is read from the environment
with 8083 as the default, and every place that declares the port (Dockerfile
env/expose, build spec, healthcheck, docs) was aligned so the container image,
the pod definition and the code agree on a single value.
