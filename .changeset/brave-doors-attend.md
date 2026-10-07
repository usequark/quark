---
"@usequark/quark-create-app": patch
---

Warn when a project will never sweep its orphaned files.

`File.uploadedBy` is `onDelete: SetNull`, so deleting a user leaves their file rows
and blobs behind rather than removing them. `CLEANUP_ORPHANED_FILES` is the only
thing that sweeps those, and it runs in the worker — which is scaffolded only
alongside the optional `jobs` feature.

Declining `jobs` therefore left orphaned rows and blobs accumulating with nothing to
surface them: the rows are valid, and no route reads `uploadedById = null`. The
realistic path there was declining the prompt or passing `--packages ui`, since
`--no-prompts` defaults to including `jobs`.

Two warnings now, both non-blocking:

- **At scaffold time**, when `jobs` is not selected, naming the consequence and the
  command to add it later.
- **At deploy time**, `discoverQuarkDeployProject` returns a `warnings` array
  alongside `diagnostics`, and `quark deploy inspect` prints it. A warning does not
  fail the deploy: `jobs` is optional and a project with no uploads has no orphan
  problem.

`warnings` is deliberately a separate field from `diagnostics`, because
`resolveQuarkDeployProject` throws on any diagnostic — folding this in would make
worker-less projects undeployable.