Wire DATABASE_URL from the deploy node in build.yaml

DATABASE_URL was declared as a per-preview secret, but it is a
graph-wired value: declare it with `from: deploy` so the preview
injects the synthesized Postgres URL from the database node.
No application code changes.
