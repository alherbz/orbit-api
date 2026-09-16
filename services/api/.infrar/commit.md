---
schema_version: 1
id: 0d8f6ec5-0116-46c7-93de-f9959f56f546
name: api
node: services/api
branch: test/prv-p4-drift
previous_commit: 53168a769c81006c85c75c5de093304ca6a27a18
---

## What changed

- **`services/api/.infrar/build.yaml`** — a fourth `requires:` entry, `auth`:
  `product: keycloak`, `version: "26.3"`, projecting `KEYCLOAK_URL: url`. No
  `tenancy:` is stated, so the product default applies. The existing `db`,
  `cache` and `queue` entries and the whole `env:` list are untouched.
- **`.infrar/environment/resources.tf`** — the matching `module "auth"`, with
  `source = "infrar/keycloak"` and `product_version = "26.3"`. No `tenancy`,
  matching the requirement.
- **`.infrar/environment/outputs.tf`** — `output "auth"` (`sensitive = true`),
  keeping the file's invariant of one sensitive output per module.

No application code, dependency manifest, Dockerfile or pod manifest was
touched; `package.json` gains no Keycloak or OIDC client.

## Why

The api node is to depend on a Keycloak identity provider, and a dependency the
build spec does not declare is one the Preview cannot run: `requires:` is what
makes the platform bind a namespace resource and project its address into the
pod environment. The repository-level declarations under `.infrar/environment/`
are updated in the same commit, as they must be whenever a `requires:` entry is
added, so the resource the repository needs is stated as OpenTofu alongside the
node that asks for it.

This commit is a declaration ahead of its consumer: nothing under
`services/api/src` reads `KEYCLOAK_URL` and no Keycloak client is installed, so
`auth` currently binds a resource the code never contacts. Wiring the variable
into the application is deliberately left to a later change.
