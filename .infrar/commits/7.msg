Retry verification of quiz broadcast API push

No code changes. The quiz broadcast API (GET /quiz/stream, POST
/quiz/broadcast) is committed and the code, Dockerfile, lockfile and
build.yaml were re-verified as coherent (valid syntax, npm ci lockfile
matches package.json, image node:20-alpine exists). The previous
verification failed platform-side with an empty error ("build
verification could not run:"), so this commit only re-triggers the
push and build verification.
