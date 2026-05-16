# Phase 7 SeaweedFS S3 Boundary

The local Phase 7 compose stack runs SeaweedFS master, volume, filer, and S3 gateway services. ArchIToken stores object references through `object_store_bindings`; API handlers should persist bucket/key/checksum metadata and never assume local filesystem paths are durable object IDs.

Default local endpoint:

```text
S3_ENDPOINT=http://localhost:8333
S3_BUCKET=architoken-assets
```

Production deployments must provision credentials and bucket policies outside the repository. Do not commit real S3 credentials.
