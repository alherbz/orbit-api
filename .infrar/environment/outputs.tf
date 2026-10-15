# The connection facts of each declared resource, as its interface defines them. Sensitive:
# they carry credentials when the module mints any. Infrar reads them per consumer.

output "minio" {
  value     = module.minio
  sensitive = true
}

output "postgres" {
  value     = module.postgres
  sensitive = true
}

output "redis" {
  value     = module.redis
  sensitive = true
}
