---
"@usequark/quark-create-app": minor
---

Standardise on Node 24. Scaffolded projects now develop and deploy on Node 24,
matching the repository's own `.nvmrc`, which already read 24 while everything
else said 22.

Generated projects change in three places:

- `.nvmrc` is `24` rather than `22`
- `apps/web` and worker Dockerfiles move to `node:24-alpine`, re-pinned by digest
- the generated project's CI matrix moves to `node-version: 24`

The image digest was resolved from the registry rather than copied, and verified
to cover `linux/amd64`, `linux/arm64` and `linux/s390x` — so Railway deployments
and local builds on Apple Silicon both resolve. Verified by scaffolding from a
packed tarball: `.nvmrc`, the Dockerfile digest and the generated CI all agree
on 24.

**The support floor is unchanged.** `engines` stays `>=22.13.0` in both
published packages, so nothing breaks for anyone installing on Node 22, and
`SUPPORT.md`, `docs/adr/001-esm-only.md` and the `engines` reference in
`docs/TESTING_INFRASTRUCTURE.md` remain accurate as written. The distinction is
deliberate:

| Declaration | Meaning | Value |
|---|---|---|
| `engines` | minimum supported | `>=22.13.0` |
| `.nvmrc` | version used to develop | `24` |
| Dockerfile | version shipped | `node:24-alpine` |
| CI | version tested | `24` |

One consequence worth naming: CI no longer exercises Node 22, so the floor is
asserted by `engines` but no longer tested. If you want the floor kept honest,
add a 22 job to the `ci.yml` matrix — say so and it is a two-line follow-up.

The repository's own CI, Dockerfiles, docs and badge move to 24 in the same
commit so the monorepo and the projects it generates do not drift apart again.