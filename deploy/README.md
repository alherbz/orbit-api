# deploy

Infrastructure root (Terraform) for Orbit: managed Postgres, Redis (ElastiCache)
and the S3 bucket for task attachments. Outputs the three endpoints the API and
the worker are configured with (see the repository README).
