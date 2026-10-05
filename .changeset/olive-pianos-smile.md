---
"@usequark/quark-create-app": patch
---

Pin the Node runtime for scaffolded projects with a `.nvmrc`.

Generated apps now ship a `.nvmrc` containing `22`, matching the
`node:22-alpine` image their Dockerfiles already pin by digest. Previously a
scaffolded project declared its Node version nowhere: no `.nvmrc`, no `engines`
field in any template `package.json`. Local development was therefore free to
drift from the container that production actually runs.

Deliberately `22` rather than the monorepo's root `.nvmrc`, which reads `24`.
The root file disagrees with everything else in this repository — CI runs
`node-version: 22`, every Dockerfile uses `node:22`, and root `engines` is
`>=22.13.0`. Copying `24` into the template would have made scaffolded local
development disagree with scaffolded Docker, which is the exact problem this
change exists to remove.

Verified by scaffolding a project from a packed tarball: `.nvmrc` is present
with `22`, alongside the existing `.dockerignore` and `.env.railway.example`,
and matches the Node major in the generated Dockerfiles.