---
"@usequark/quark-core": patch
"@usequark/quark-create-app": patch
---

Trim the published CLI tarball and add npm search keywords to both packages.

**Test files are no longer published.** `files` now negates `src/**/*.test.js`,
which drops 12 files (~72 KB) from the tarball — 237 files down to 225. Nothing
imported them: the only reference to a test file anywhere in shipped source is a
comment, and `test-cli.js` that runs them was already excluded because it sits
outside `files`. Nothing shipped is lost.

Verified by packing both variants and diffing the resulting tarballs: exactly the
12 test files are removed and nothing else. `deploy.integration.test.js` is
covered by the same glob, so one pattern is enough. The templates are untouched —
they contain no test files, so the negation cannot affect a scaffolded project's
own tests. CI runs the E2E suite from the repository rather than from a packed
tarball, so it is unaffected.

The packed tarball was installed into a clean directory and smoke-tested: the
`quark` binary resolves and reports its version.

**`keywords` added.** npm's `scope:` search qualifier returns nothing even for
packages published eight months ago, so it is not a usable discovery path, and a
search for the scoped name surfaces unrelated higher-population packages first.
Keywords are the field npm actually weighs, and neither package declared any:

- `@usequark/quark-core` — quark, nextjs, auth, bullmq, redis, email, storage,
  rate-limiting, logging, zod
- `@usequark/quark-create-app` — quark, scaffolding, scaffolder, cli, nextjs,
  prisma, bullmq, railway, self-hosted

Neither change affects runtime behaviour or any exported API.