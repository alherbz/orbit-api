Add quiz broadcast API (SSE) to orbit-api

Add GET /quiz/stream (Server-Sent Events subscription) and POST
/quiz/broadcast, which fans a quiz out to every connected client as an
SSE `quiz` event. The broadcast accepts a custom {question, options,
answer} body or falls back to a random built-in quiz, and reports how
many clients received it. The requested GET /health endpoint already
existed and returns 200. Knowledge file updated accordingly.
