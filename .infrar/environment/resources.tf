module "db" {
  source          = "infrar/postgres"
  product_version = ">=15 <17"
  tenancy         = ["database"]
}

module "cache" {
  source          = "infrar/redis"
  product_version = ">=6"
}
