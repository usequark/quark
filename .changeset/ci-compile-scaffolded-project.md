---
"@usequark/quark-create-app": patch
---

Compile a scaffolded project in CI. The full-lifecycle E2E harness (`test-e2e-full.js`) now runs the generated project's own `pnpm build` and asserts the Next.js build artefact exists, and the CLI E2E workflow runs on pull requests touching `packages/cli/**`. Previously every CLI check was structural (`existsSync` / string matching) and `pnpm dev` compiled routes lazily, so a static import of a package that the selected features did not install passed CI and only failed for the user. Test infrastructure only; no scaffold output changes.
