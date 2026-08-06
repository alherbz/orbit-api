---
schema_version: 1
id: 15862494-86f1-4d79-8a14-3c7bda3fba4c
name: orbit-api
node: services/api
branch: develop
previous_commit: 6de146fc9092a705094ee19a22073f8415da5d3d
---

## What changed
- `services/api/Dockerfile`: base image changed from `node:20-alpine` to `node:20.99.99-alpine`.
- `services/api/.infrar/knowledge.md`: updated to reflect the new base image and to record that the tag does not exist on Docker Hub.

## Why
The user explicitly asked to pin the base image to `node:20.99.99-alpine` and confirmed to apply it despite the warning. The tag was checked against the Docker Hub registry and returned 404, so the container image build is expected to fail until the tag is changed back to an existing one (e.g. `node:20-alpine`). No other run-time settings changed: the app still listens on port 8083 (already configured in the code, Dockerfile, and build.yaml), so `build.yaml` needed no update.
