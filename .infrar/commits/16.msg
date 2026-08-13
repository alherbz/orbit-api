Serve the API under the /api base path expected by the preview routing

The preview routes /api/* from the web origin straight to this service
without stripping the prefix, so routes registered at the root answered
404 through the proxy. All existing routes (/health, /tasks,
/tasks/:id/share, /quiz/stream, /quiz/broadcast) are now registered
inside an encapsulated Fastify plugin with { prefix: '/api' }, matching
the paths the frontend already calls (/api/...).

An unprefixed GET /health (same handler) is kept because the pod's own
healthcheck probes the container directly at the path declared in
.infrar/build.yaml (/health), not through the router. No build.yaml
change is needed: run.api_prefix is omitted, which is the /api default,
and the healthcheck path still matches the unprefixed route.
