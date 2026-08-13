---
schema_version: 1
id: 7fd28ec1-739d-4349-9b29-93cb2dd4d081
name: deploy
node: deploy
category: iac
---
## Purpose
Terraform infrastructure root for the Orbit project. It provisions the one piece of managed infrastructure the system needs: an AWS RDS Postgres instance backing the `orbit-api` task service (the `services/api` app node, which consumes it via `DATABASE_URL`).

## Structure
Minimal single-directory Terraform root module:
- `main.tf` — `terraform`/provider blocks (Terraform >= 1.5, `hashicorp/aws` ~> 5.0), the `aws_db_instance.orbit` resource, and a `database_endpoint` output.
- `variables.tf` — four inputs: `region` (default `eu-west-1`), `environment` (default `prod`), `db_username` (default `orbit`), and `db_password` (sensitive, no default).
- `README.md` — describes the node's role as an independently deployable `iac` root.

There is no backend configuration (state is local by default), no modules, and no tfvars files committed.

## Behavior
Applied with the standard Terraform lifecycle (`init`/`plan`/`apply`/`destroy`). It creates one RDS instance:
- Identifier `orbit-${var.environment}` (e.g. `orbit-prod`), engine Postgres 16, class `db.t3.micro`, 20 GB allocated storage, database name `orbit`.
- Credentials come from `db_username`/`db_password`; `db_password` has no default, so it must be supplied at plan/apply time (tfvars, `-var`, or `TF_VAR_db_password`).
- `publicly_accessible = false` and `skip_final_snapshot = true` — no final snapshot on destroy, so data is dropped when the instance is destroyed.
- Outputs `database_endpoint` (the RDS `host:port` endpoint) for consumers to build the API's connection string.

In an Infrar Application Preview this node is not provisioned as real cloud infrastructure: Infrar synthesizes an equivalent Postgres as a schema in the per-org preview Postgres and wires it to the app. The node is instead the subject of the Infra Preview topology graph.

## Dependencies
- Terraform >= 1.5 and the AWS provider ~> 5.0.
- AWS credentials with RDS permissions in the target region (default `eu-west-1`).
- A value for the sensitive `db_password` variable at apply time.
- Downstream: the `services/api` node depends on the database this module creates; since `database_endpoint` is host:port only, the consumer assembles the full `DATABASE_URL` (username, password, database name `orbit`) separately.

## Notes
- No remote state backend is configured, so state is local — a real multi-user deployment would want an S3 or other remote backend.
- The module declares no VPC, subnet group, or security group, so the instance lands in the account/region defaults; being non-publicly-accessible, the API must run inside a network that can reach it.
- `skip_final_snapshot = true` is a demo-friendly setting; production use would typically enable a final snapshot and deletion protection.
- The password passes through Terraform state in plaintext (standard RDS caveat); the `sensitive` flag only redacts CLI output.
