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

# Postgres for the task API and the worker.
resource "aws_db_instance" "orbit" {
  identifier          = "orbit-${var.environment}"
  engine              = "postgres"
  engine_version      = "16"
  instance_class      = "db.t3.micro"
  allocated_storage   = 20
  db_name             = "orbit"
  username            = var.db_username
  password            = var.db_password
  skip_final_snapshot = true
  publicly_accessible = false
}

# Redis: the API's task cache and the task-events queue the worker consumes.
resource "aws_elasticache_cluster" "orbit" {
  cluster_id      = "orbit-${var.environment}"
  engine          = "redis"
  engine_version  = "7.1"
  node_type       = "cache.t3.micro"
  num_cache_nodes = 1
}

# Task attachments. The API expects this bucket to exist; it never creates it.
resource "aws_s3_bucket" "attachments" {
  bucket = "orbit-attachments-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "attachments" {
  bucket                  = aws_s3_bucket.attachments.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "database_endpoint" {
  value = aws_db_instance.orbit.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.orbit.cache_nodes[0].address
}

output "attachments_bucket" {
  value = aws_s3_bucket.attachments.bucket
}
