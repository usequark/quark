---
"@techstream/quark-create-app": patch
---

Guard that the release PR's runs are approved without a human click.

Changesets opens the release PR with GITHUB_TOKEN, and GitHub holds runs
triggered by GITHUB_TOKEN until a human approves them. Every release PR
therefore sat at `action_required` and reported no check runs at all, so
branch protection's required checks could never be satisfied and the release
PR could not be merged.

Two assertions: the auto-approve workflow must exist, and it must key on
`conclusion === 'action_required'` rather than on run status. A run awaiting
approval reports `status: completed`, so a status-based filter would silently
approve nothing and the stall would persist while appearing fixed.
