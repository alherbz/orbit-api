output "db" {
  value     = module.db
  sensitive = true
}

output "cache" {
  value     = module.cache
  sensitive = true
}
