---
schema_version: 2
id: 7fd28ec1-739d-4349-9b29-93cb2dd4d081
name: deploy
node: deploy
category: iac
---

## Purpose
Terraform infrastructure root for Orbit: the `iac` node declaring the one piece of managed infrastructure the system needs — an AWS RDS Postgres 16 instance backing the `services/api` task service.

## Files
| Path | Role |
|---|---|
| deploy/main.tf | The `terraform`/`required_providers` blocks, the `aws` provider, the `aws_db_instance.orbit` resource, and the `database_endpoint` output |
| deploy/variables.tf | Inputs `region`, `environment`, `db_username`, `db_password` |
| deploy/README.md | States the node's role as an independently deployable `iac` root, and that Application Preview synthesizes the Postgres instead of provisioning it |

## Surface
**Exposes** — a Terraform root module driven by the standard `init` / `plan` / `apply` / `destroy` lifecycle. Resource `aws_db_instance.orbit`: `identifier = "orbit-${var.environment}"`, `engine = "postgres"`, `engine_version = "16"`, `db.t3.micro`, 20 GB `allocated_storage`, `db_name = "orbit"`, `publicly_accessible = false`, `skip_final_snapshot = true`. Output `database_endpoint` = `aws_db_instance.orbit.endpoint` (the RDS `host:port`). Inputs: `region` (default `eu-west-1`), `environment` (default `prod`), `db_username` (default `orbit`), `db_password` (`sensitive = true`, **no default**).

**Consumes** — Terraform `>= 1.5` and provider `hashicorp/aws` `~> 5.0`; AWS credentials with RDS permissions in the target region; a value for `db_password` at plan/apply time (a tfvars file, `-var`, or `TF_VAR_db_password`). No remote backend, no child modules, no committed tfvars, no provider credentials in the repository.

## Behavior
A single `apply` creates one RDS Postgres instance in the account and region resolved from `var.region`, named per `var.environment`, with credentials from `db_username`/`db_password`, and publishes its endpoint. Because `skip_final_snapshot = true` and no deletion protection is set, a `destroy` drops the data with no final snapshot.

In an Infrar Application Preview this node is **not** provisioned as real cloud infrastructure: the platform synthesizes an equivalent Postgres in-cluster and wires it to the app node, which is why `services/api` reads its connection string from `DATABASE_URL` rather than from any Terraform output. The node is instead the subject of the Infra Preview topology graph.

## Notes
- The database node the project graph extracts from this Terraform is named **`orbit`**, after `aws_db_instance.orbit` — not `deploy`. That is the name `services/api/.infrar/build.yaml` must use in `DATABASE_URL`'s `from:`; wiring it `from: deploy` leaves the variable silently unset in preview. Renaming or replacing the resource breaks that link.
- `engine_version = "16"` here is the version statement the api node's code is checked against; the SQL in `services/api/src/server.js` uses nothing newer than Postgres 9.5, so the pin is comfortable but it is the number any Postgres requirement declaration should match.
- `database_endpoint` is `host:port` only, so a consumer assembles a full `DATABASE_URL` itself from username, password and the database name `orbit`. Nothing in this root emits a connection string.
- No VPC, subnet group or security group is declared, so the instance lands in the account defaults; being non-publicly-accessible, anything reaching it must run in a network with access.
- No `backend` block, so state is local — a real multi-user deployment would want S3 or another remote backend. The password lands in state in plaintext either way; `sensitive = true` only redacts CLI output.
- `skip_final_snapshot = true`, `db.t3.micro` and the missing deletion protection are demo-friendly settings, not production ones.
- `iac` node: it has no `build.yaml`, no pod manifest, and must never get either — nothing here is built into an image or run as a pod.
