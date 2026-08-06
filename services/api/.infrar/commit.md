---
schema_version: 1
id: 15862494-86f1-4d79-8a14-3c7bda3fba4c
name: orbit-api
node: services/api
branch: develop
previous_commit: 2942dad7006b44cf5f16cea0158e3e828b39ca8c
---

## What changed
- Added `services/api/package-lock.json`, generated from the existing `package.json` (fastify ^4.28.1, pg ^8.12.0) with `npm install --package-lock-only`.
- Updated `services/api/Dockerfile`: the dependency step now copies both `package.json` and `package-lock.json` and runs `npm ci --omit=dev` instead of `npm install --omit=dev`.

## Why
The user asked to use `npm ci` in the orbit-api Dockerfile. `npm ci` requires a lockfile, which the repo did not have, so one was generated and committed. `npm ci` gives reproducible builds pinned to the lockfile and fails fast if the lockfile and `package.json` drift apart.
