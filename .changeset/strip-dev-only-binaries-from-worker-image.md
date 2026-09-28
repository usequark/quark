---
"@techstream/quark-create-app": patch
---

Strip dev-only native binaries from the worker runtime image

`pnpm deploy --prod` correctly drops `prisma` (a devDependency of `packages/db`),
but it keeps the peer subtrees pnpm auto-installed *for* that devDependency.
`prisma` declares `typescript` as an optional peer, and pnpm's `autoInstallPeers`
installs it anyway - resolving to `typescript@7`, the native Go build, which ships
a ~100 MB Go `tsc` carrying 10 HIGH CVEs (Go stdlib, `golang.org/x/text`,
`golang.org/x/net`).

That made the nightly `Container Security` scan fail on the worker image. Nothing
at runtime needs it: the worker runs compiled JS and reaches Postgres through
`@prisma/client`. The worker Dockerfile now prunes the auto-installed peer
subtrees (including the peer-suffixed directories such as
`valibot@1.4.2_typescript@7.0.2` and nested `.bin/tsc` shims) before the deploy
output is copied into the runtime stage, and fails the build if a dev-only binary
reappears. Applied to the monorepo Dockerfile and the scaffold template.
