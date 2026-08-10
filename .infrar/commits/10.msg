Retry quiz broadcast push verification (preview-be still unavailable)

No code changes. The quiz broadcast API (GET /quiz/stream, POST
/quiz/broadcast) has been committed since bba521e. Re-verified this
turn: src/server.js defines both endpoints and binds 0.0.0.0:8083,
the working tree is clean at 3bb804f, and build.yaml (dockerfile
strategy, port 8083, /health healthcheck) still matches the code.

This is the fifth consecutive platform-side verification failure
("gitconfig not found", empty message, "AggregateError", and twice
"preview-be API unavailable: request failed"). The verification
service was unreachable before any build could run; nothing points
at the application code or the build spec. This commit only
re-triggers the push and build verification at the user's request.
