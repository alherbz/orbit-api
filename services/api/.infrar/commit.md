---
schema_version: 1
id: 15862494-86f1-4d79-8a14-3c7bda3fba4c
name: orbit-api
node: services/api
branch: develop
previous_commit: c5d0c4688ad230e15105185bdadc2e4a494557ee
---

## What changed
- `services/api/.gitignore` (new): re-includes `package-lock.json` via a `!package-lock.json` negation (and keeps `node_modules/` ignored), overriding the repo-root `.gitignore` rule that excluded it. As a result, the existing `services/api/package-lock.json` is now committed.
- `services/api/.infrar/knowledge.md`: updated to document why the lockfile must stay tracked.

## Why
The image build failed with `lstat .../services/api/package-lock.json: no such file or directory`: the repo-root `.gitignore` lists `package-lock.json`, so the lockfile present in the working tree was never committed and was absent from the kaniko build context, breaking the Dockerfile's `COPY package.json package-lock.json ./` step. Re-including the lockfile makes it part of the repo so `npm ci --omit=dev` can run reproducibly. No code or Dockerfile change was needed — the app already listens on 0.0.0.0:8083, matching `build.yaml`.
