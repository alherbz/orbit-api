module "db" {
  source          = "infrar/postgres"
  product_version = ">=15 <17"
  tenancy         = ["database"]
}

module "cache" {
  source          = "infrar/redis"
  product_version = ">=6"
  tenancy         = ["db-index"]
}

module "queue" {
  source = "infrar/rabbitmq"
}

module "auth" {
  source          = "infrar/keycloak"
  product_version = "26.3"
}

module "db-mongodb" {
  source = "infrar/mongodb"
}
