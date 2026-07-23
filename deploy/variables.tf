variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "db_username" {
  type    = string
  default = "orbit"
}

variable "db_password" {
  type      = string
  sensitive = true
}
