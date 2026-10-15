# One module per resource this repository needs. The `source` names an Infrar product, the
# `product_version` the range the code was written against, the `tenancy` the unit each consumer
# gets inside a shared instance. Which NAMESPACE resource a declaration becomes — its own, or
# one another repository already declared — is decided in the namespace, not here. Edit
# freely; Infrar re-reads this file. Anything OpenTofu accepts is accepted here too; only a
# literal value, a tenant id, a hostname, a backend or a provider credential is refused.

module "minio" {
  source = "infrar/s3"
}

module "postgres" {
  source = "infrar/postgres"
  product_version = "16"
}

module "redis" {
  source = "infrar/redis"
  product_version = "7"
}
