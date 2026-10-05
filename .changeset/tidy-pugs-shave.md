---
"@usequark/quark-create-app": patch
---

Fix scaffolded projects being generated with no `.gitignore`.

**npm strips every `.gitignore` out of published tarballs**, unconditionally and
with no opt-out. `base-project/.gitignore` is a generated template file, so it
existed in the repository — where it looked correct in review — but never reached
anyone installing the CLI from npm. Only a git checkout ever had it.

Projects scaffolded from the published package arrived with `.dockerignore`,
`.nvmrc`, `.env.example` and `.env.railway.example`, and no `.gitignore`. Since
the scaffolder runs `git init`, the first `git add .` in a generated project
staged `node_modules/`, `.next/`, and `.env` — the last populated with real
credentials by `scripts/prepare.js`.

The content now lives in `src/scaffold-gitignore.js`, which ships because npm
strips only `.gitignore` and `.npmrc`. The scaffolder writes the file when a
template copy does not supply one, and `generate-templates.js` writes the
in-repo copy from the same export, so the file a contributor sees and the file a
user gets cannot drift.

Verified from a packed tarball — 0 `.gitignore` entries in it, the module
present — by scaffolding and committing a project with a populated `.env`:
`.env` and `node_modules/` are ignored, `.env.example` is committed. The
generator's output is byte-identical to before, so nothing else moved.

Also fixes a latent race in `scaffold-guards.test.js`. git auto-gc prunes loose
object directories in the background after a commit, and `copyFixture()` walked
`.git/objects` while that prune was in flight, aborting the process with a C++
`filesystem_error` rather than an assertion failure. It was already intermittent
(3/10 runs) and this change made it common (8/10), because fewer files reach
`git add` now and the object layout shifts. Setting `gc.auto 0` on the fixture
repo removes the race: 20/20 clean, and the full suite now passes under turbo's
parallelism, which it previously did not.