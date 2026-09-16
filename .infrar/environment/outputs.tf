output "db" {
  value     = module.db
  sensitive = true
}

output "cache" {
  value     = module.cache
  sensitive = true
}

output "queue" {
  value     = module.queue
  sensitive = true
}

output "auth" {
  value     = module.auth
  sensitive = true
}

output "db-mongodb" {
  value     = module.db-mongodb
  sensitive = true
}
