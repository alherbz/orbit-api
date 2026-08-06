---
schema_version: 1
id: 15862494-86f1-4d79-8a14-3c7bda3fba4c
name: orbit-api
node: services/api
branch: develop
previous_commit: a47d1cbb432eed55baaa88d1f32f929ab109d493
---

## What changed

- `Dockerfile`: the base image is now `node:20.99.99-alpine` (previously
  `node:20-alpine`). Nothing else in the image recipe changed: same
  `WORKDIR /app`, same `npm install --omit=dev`, same `ENV PORT=8083`,
  `EXPOSE 8083` and `CMD ["node", "src/server.js"]`.
- `.infrar/build.yaml` needs no change: it references the Dockerfile by path
  (`dockerfile: Dockerfile`) and does not declare a base image, and the serving
  port (8083) and healthcheck (`GET /health`) are unaffected.

## Why

Requested pin to an explicit base image tag instead of the floating `20-alpine`
tag, so the runtime version is fixed by the Dockerfile.

Note: the `node:20.99.99-alpine` tag is not published on Docker Hub (the Node 20
line stops at 20.20.x and is end-of-life), so the image build will fail while
resolving the `FROM` instruction. The tag was applied as explicitly requested;
changing the first line of the Dockerfile to a published tag (for example
`node:20.20-alpine` or `node:22-alpine`) is all that is needed to make the build
resolve again.
