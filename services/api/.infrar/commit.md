---
schema_version: 1
id: 15862494-86f1-4d79-8a14-3c7bda3fba4c
name: orbit-api
node: services/api
branch: develop
previous_commit: 618b498f85dc4e1f71be49dac4d085d2c5a3ea53
---

## What changed
- `services/api/Dockerfile`: base image reverted from `node:20.99.99-alpine` back to `node:20-alpine`.
- `services/api/.infrar/knowledge.md`: updated to reflect the working base image.

## Why
The image build failed: kaniko could not pull `node:20.99.99-alpine` because that tag does not exist on Docker Hub (MANIFEST_UNKNOWN). Reverting to the existing `node:20-alpine` tag makes the build succeed again. Nothing else needed fixing — the application already listens on 0.0.0.0 at port 8083 (PORT env default), matching `build.yaml` (`run.port: 8083`, healthcheck on `/health:8083`).
