module "db" {
  source          = "infrar/postgres"
  product_version = ">=15 <17"
  tenancy         = ["database"]
}
