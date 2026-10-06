---
"@usequark/quark-create-app": patch
---

fix(deploy): import `preserve` in the generated Railway IaC file, so `quark deploy railway` stops failing on the first deploy

Every scaffolded project's `.railway/railway.ts` called `preserve()` four times
without importing it:

```ts
import { defineRailway, project, service } from "railway/iac";  // no preserve
...
      AUTH_SECRET: preserve(),   // ReferenceError
```

The Railway CLI only evaluates that file at `railway config apply`, in the
user's own account, so nothing in this repo ever evaluated it. Every deploy
died at the apply step with:

```
ReferenceError: preserve is not defined
```

Three layers missed it, which is why the fix touches all three:

- `packages/cli/templates/base-project/.railway/railway.ts` — the static file
  shipped in every scaffold, now imports `preserve`.
- `packages/cli/src/deploy/adapters/iac.js` — `generateIacFile()` regenerates
  this file during deploy and hardcoded the same three-name import. The list is
  now derived from the helpers the generated body actually calls, so a helper
  can never be emitted without being in scope.
- `packages/cli/src/deploy/adapters/railway.test.js` — the existing test
  asserted `content.includes("preserve()")`, which passes on the broken file
  because the call site is present. It now checks that every helper the body
  calls appears in the import list, and names the `preserve` regression
  explicitly. Verified to fail against the old generator.

Reproduced by evaluating the shipped template against `railway@3.12.0`:

```
THREW -> ReferenceError: preserve is not defined
```

and passing once `preserve` is added to the import.

No behaviour change on a working deploy — `preserve()` was always intended, and
Railway kept the existing secret either way. This only makes the file valid so
the apply step can run.
