terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# Managed Postgres for the Orbit task API.
# In an Infrar Application Preview this IaC node is NOT provisioned as real
# cloud infra — it is synthesized as a schema in the per-org preview Postgres.
resource "aws_db_instance" "orbit" {
  identifier           = "orbit-${var.environment}"
  engine               = "postgres"
  engine_version       = "16"
  instance_class       = "db.t3.micro"
  allocated_storage    = 20
  db_name              = "orbit"
  username             = var.db_username
  password             = var.db_password
  skip_final_snapshot  = true
  publicly_accessible  = false
}

output "database_endpoint" {
  value = aws_db_instance.orbit.endpoint
}
