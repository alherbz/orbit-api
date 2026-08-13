Extend GET /health with the storage mode for the web status chip

The health payload now includes "storage": "postgres" when the Postgres
pool is connected and "memory" when the API runs on the in-memory
fallback, so the orbit-web header chip can show which store backs the
board. No other route, port or build change.
