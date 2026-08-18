---
"@techstream/quark-create-app": patch
---

fix(ci): auto-sync scaffold templates during release to prevent drift

The release workflow bumps package versions via changesets but never
re-synced scaffold templates, so every release created template drift
that blocked unrelated PRs. Templates are now re-synced inside the
changesets version step, and CHANGELOG.md files are excluded from sync
since they are release artifacts, not scaffold content.
