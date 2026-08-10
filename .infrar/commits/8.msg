Retry quiz broadcast push verification (platform-side failures)

No code changes. The quiz broadcast API (GET /quiz/stream, POST
/quiz/broadcast) has been committed since bba521e and re-verified
again this turn: src/server.js passes a syntax check, the Dockerfile,
package-lock.json and build.yaml are unchanged and coherent.

All three previous verification attempts failed platform-side before
the build could run ("gitconfig not found for user ...", "build
verification could not run:" with an empty message, then "build
verification could not run: AggregateError") — none of them point at
the application code or the build spec. This commit only re-triggers
the push and build verification at the user's request.
