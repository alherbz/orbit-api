Retry share-by-email build verification (cluster repo access fixed)

No code change. The previous build failed because the cluster could not
clone the repository (missing cloud SSH key on the git provider). The
user has now registered the key, so this commit only re-triggers the
build verification of the existing share-by-email feature.
