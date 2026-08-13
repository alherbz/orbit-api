Fix DATABASE_URL preview wiring: from orbit database node

Change the api node's build.yaml DATABASE_URL env entry to
`from: orbit` — the database node the project graph extracts from
the Terraform — instead of the deploy IaC root, so the preview
matches the link and injects the synthesized Postgres URL.
