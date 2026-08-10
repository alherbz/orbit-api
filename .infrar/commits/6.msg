Retry finalization of quiz broadcast API push

No code changes. The quiz broadcast API (GET /quiz/stream, POST
/quiz/broadcast) was already committed in bba521e, but the previous
push failed to finalize on the platform side ("could not fetch the
pushed branch: gitconfig not found for user"). This commit only
re-triggers the push/verification of the branch.
