# .infrar/environment — what this repository needs to run

Written by Infrar (rules 2), inside the directory Infrar owns. These files
declare the resources the application nodes of this repository require, by product and version,
as OpenTofu. Infrar reads them to realise those resources in every namespace the repository is
imported into, and updates them in the same commit as the `requires:` they answer. They carry
no value, no host, no id and no tenant, so the same files serve every namespace and every
execution target. This is not a node of the repository: nothing here is built or deployed.

## Resources

| Declaration | Product | Version | Tenancy | Origin |
|---|---|---|---|---|
| `minio` | s3 | any | default |  |
| `postgres` | postgres | 16 | default |  |
| `redis` | redis | 7 | default |  |

## Requirements → declarations

| Node | Requirement | Declaration |
|---|---|---|
| `api` | `minio` | `minio` |
| `api` | `postgres` | `postgres` |
| `api` | `redis` | `redis` |
| `worker` | `postgres` | `postgres` |
| `worker` | `redis` | `redis` |

## What you may edit

Everything. Rename a declaration, pin a version, add a resource Infrar has no product for as an
ordinary OpenTofu module or resource. Infrar re-reads the files and records anything outside its
own grammar as a gap it will learn from. Four things are refused, with the reason: a literal
secret, a tenant id or hostname, a `backend` block, and a provider credential.
