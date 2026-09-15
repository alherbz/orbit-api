# A root irp/ the team owns. PRV D2: Infrar must not read this as its declarations, nor edit,
# move or remove it. The module below must NOT become a namespace resource.
module "legacy_cache" {
  source = "infrar/valkey"
}
