---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: develop
previous_commit: 4c4d0e303dc8886a5c65cc2f86e553ffcffb2c6a
---

## What changed
- Nothing in the code. This is a verification retry: the share-by-email endpoint (`POST /tasks/:id/share`) and its build.yaml env declarations are already committed in `4c4d0e3`.

## Why
The previous build failed with a repository-access error: the cluster could not clone the repo because the cloud SSH key was not registered with the git provider. The user has now added the key in Settings → Git, so the build only needs to be re-run — no code or build-spec fix is required.
