---
schema_version: 1
id: 15862494-86f1-4d79-8a14-3c7bda3fba4c
name: orbit-api
node: services/api
branch: develop
previous_commit: c24c4d17fcf547f6f532c2386926343dfbc71ce9
---

## What changed

- `Dockerfile`: the base image is back to `node:20-alpine` (it was
  `node:20.99.99-alpine`). Only the `FROM` line changed; the rest of the image
  recipe is identical: `WORKDIR /app`, `COPY package.json ./`,
  `RUN npm install --omit=dev`, `COPY . .`, `ENV PORT=8083`, `EXPOSE 8083`,
  `CMD ["node", "src/server.js"]`.
- `.infrar/build.yaml`: unchanged. It references the Dockerfile by path
  (`dockerfile: Dockerfile`) and does not declare a base image, so reverting the
  `FROM` line does not affect the build spec. The serving port (8083), the
  healthcheck (`GET /health` on 8083) and the declared env vars stay valid.

## Why

The previous pin to `node:20.99.99-alpine` referenced a tag that is not
published on Docker Hub, so the image build failed on the very first
instruction and the pod never started. Restoring the floating `node:20-alpine`
tag makes the base image resolvable again, so the build can proceed to
`npm install` and the service can serve on port 8083.
