---
"@techstream/quark-create-app": patch
---

Clear all 13 Biome lint warnings, each with a stated reason

`noTemplateCurlyInString` (10) was firing on Railway's own `${{Service.VAR}}`
reference syntax in `.railway/railway.ts` and in the adapter test fixtures that
exist to exercise that syntax, plus the escaper test for a literal `${}`. The
rule cannot distinguish those from a missed template interpolation, so both
files carry a file-scoped `biome-ignore-all` explaining why.

`noUndeclaredEnvVars` (3) was firing on `npm_execpath` and the two
`QUARK_SKIP_*` escape hatches in `scripts/`. These are repo tooling, not app or
build inputs, and are suppressed individually.

I also tried allowing them centrally via `allowedEnvVars` in `biome.json`, and
rejected it: `turbo.json` declares no `globalEnv` at all, so explicitly
configuring the rule activated it repo-wide and took the count from 13 to 194.
Fixing that properly means declaring the real env surface in `turbo.json`, which
is a separate change with its own caching implications.

The rules stay active - verified that a genuinely undeclared variable and a
missed template literal in an unsuppressed file are both still reported.
