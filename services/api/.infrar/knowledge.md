## Purpose
HTTP API service ('orbit-api') that provides the backend application entrypoint for the Orbit system: a small task-management API. Packaged as a containerized Node.js service.

## Structure
Node.js (ESM) application rooted at services/api. Entry point is src/server.js, a single-file Fastify server. package.json declares dependencies (fastify, pg) and the `start` script; package-lock.json pins the full dependency tree. Dockerfile (node:20.99.99-alpine) plus .dockerignore support container image builds.

## Behavior
src/server.js starts a Fastify server on 0.0.0.0 at the port from the PORT env var (default 8083). Routes: GET /health (status check), GET /tasks and POST /tasks (task list backed by Postgres when DATABASE_URL is set, otherwise an in-memory fallback so the app runs without a database). On startup with a database it creates the `tasks` table if missing and seeds two sample rows.

## Dependencies
Node.js >= 20; npm packages fastify and pg, resolved via package-lock.json. Optional Postgres via the DATABASE_URL env var (wired from the db node in preview). Docker for image builds: the Dockerfile copies package.json and package-lock.json, runs `npm ci --omit=dev` for reproducible installs, sets PORT=8083, and starts `node src/server.js`.

## Notes
The image build requires package-lock.json to be present and in sync with package.json (`npm ci` fails otherwise); update the lockfile whenever dependencies change. WARNING: the base image tag `node:20.99.99-alpine` does not exist on Docker Hub (verified 404 as of 2026-08-06) — it was pinned at the user's explicit request, and the image build will fail until it is changed back to a real tag (e.g. `node:20-alpine`). The in-memory task store is per-process and resets on restart — it exists only as a no-database fallback.
