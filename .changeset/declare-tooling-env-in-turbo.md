---
"@techstream/quark-create-app": patch
---

Declare the repo's tooling env vars in `turbo.json` instead of silencing them

`noUndeclaredEnvVars` was firing on six environment variables that have no
business being file-scoped suppressions: `npm_execpath` and
`npm_lifecycle_event` (injected by the package manager), the three
`QUARK_SKIP_*` escape hatches used by repo tooling, and `GITHUB_OUTPUT` (set
by the CI runner). They are now declared in `turbo.json`'s `globalEnv`, which
is where they actually belong, and the suppressions are gone.

Adding the declaration does not surface new warnings across the repo's ~125
referenced environment variables — `turbo.json` already declared the rest at
task level through `env` and `passThroughEnv`, which satisfies the rule the
same way.

Verified by removing the declaration again: 5 diagnostics return, and 0 with
it present.
