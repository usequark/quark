---
"@usequark/quark-create-app": patch
"@usequark/quark-core": patch
---

Normalise CHANGELOG links to the current repository URL

153 links across three CHANGELOG files still pointed at
`github.com/Bobnoddle/quark`, from before the repository moved to the `usequark`
org. GitHub redirects them correctly, so no link was broken — but the repo is
public now, and a reader expanding a diff link sees the pre-transfer path.

This rewrites the host only: `github.com/Bobnoddle/quark` becomes
`github.com/usequark/quark`. Commit SHAs, PR numbers, and the
`Thanks [@Bobnoddle]` attributions are untouched, because those are the
historical record and they remain accurate.

Pure substitution — 102 lines, all URL host. No behaviour change and no
published-file content change beyond the link target.