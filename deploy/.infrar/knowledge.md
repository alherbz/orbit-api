---
schema_version: 2
id: 7fd28ec1-739d-4349-9b29-93cb2dd4d081
name: deploy
node: deploy
category: iac
---

## Purpose

Terraform root for Orbit's AWS PostgreSQL database, Redis cache and queue, and S3 task-attachment bucket.

## Files

| Path | Role |
| --- | --- |
| `deploy/main.tf` | Terraform and AWS provider requirements; database, Redis, and bucket resources; exported outputs. |
| `deploy/variables.tf` | Region, environment, database username, and sensitive password inputs. |
| `deploy/README.md` | Short description of the infrastructure root and its consumers. |

## Surface

**Exposes:** Terraform root for `terraform init`, `plan`, and `apply`; outputs `database_endpoint`, `redis_endpoint`, and `attachments_bucket` for the API and worker. No routes or listening port.

**Consumes:** Terraform variables `region` (default `eu-west-1`), `environment` (default `prod`), `db_username` (default `orbit`), and required sensitive `db_password`; the HashiCorp AWS provider (`~> 5.0`) and AWS credentials/configuration supplied to that provider. No application environment variables are read directly.

## Behavior

- Creates a PostgreSQL 16 RDS instance named `orbit-${var.environment}` with database `orbit`, 20 GiB storage, and `db.t3.micro` instance class.
- Creates a single-node Redis 7.1 ElastiCache cluster named `orbit-${var.environment}` on `cache.t3.micro`; the API uses it for task caching and the task-events queue consumed by the worker.
- Creates S3 bucket `orbit-attachments-${var.environment}` and a public-access block for task attachments. The API expects the bucket to exist already.
- Publishes the RDS endpoint, first Redis node address, and bucket name as Terraform outputs for application configuration.

## Notes

- `db_password` is required and marked sensitive; `environment` controls resource names, so changing it selects different named resources.
- RDS is not publicly accessible and skips its final snapshot on deletion. Network and security-group settings are not defined here, so access depends on provider/AWS defaults and external configuration.
- All four S3 public-access-block settings are enabled. The configuration does not provision application services or wire output values into their environment variables.
