Retry quiz broadcast push verification (preview-be unavailable)

No code changes. The quiz broadcast API (GET /quiz/stream, POST
/quiz/broadcast) has been committed since bba521e and was re-verified
again this turn: src/server.js passes a syntax check, and the
Dockerfile, package-lock.json and build.yaml are unchanged and
coherent (node:20-alpine, npm ci, port 8083, /health healthcheck,
0.0.0.0 bind).

This is the fourth platform-side verification failure in a row —
"gitconfig not found for user ...", an empty "build verification
could not run:" message, "AggregateError", and now "preview-be API
unavailable: request failed". None of them point at the application
code or the build spec: the verification service itself was
unreachable before any build could run. This commit only re-triggers
the push and build verification at the user's request.
