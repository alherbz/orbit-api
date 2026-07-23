# deploy

Infrastructure root (Terraform) for Orbit: a managed Postgres instance.

This is an `iac` node — an independently deployable infrastructure root.
Infrar's Application Preview ignores it and synthesizes an equivalent Postgres
in-cluster; it is the subject of the Infra Preview topology graph instead.
