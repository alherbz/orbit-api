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
  source          = "infrar/rabbitmq"
  product_version = ">=4.1"
  tenancy         = ["vhost"]
}

module "auth" {
  source          = "infrar/keycloak"
  product_version = "26.3"
}

module "db-mongodb" {
  source          = "infrar/mongodb"
  product_version = ">=4.4"
  tenancy         = ["database"]
}
