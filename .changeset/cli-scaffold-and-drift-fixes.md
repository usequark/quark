---
"@usequark/quark-create-app": patch
---

Fix two CLI defects in scaffolded output and drift checking.

- `quark create <name> --packages ui` (or `--packages pwa`) no longer produces a project that fails `next build`. The register route reached the queue through an enqueue helper that imported `@<scope>/jobs`; the dependency was dropped and `transpilePackages` patched when jobs was not selected, so the import resolved to nothing. The queue and job names now live in the web module as local constants, and the dead scaffold-time stripper (which had been orphaned since the enqueue moved to its own module, and whose marker regex matched nothing in the repository) is gone. A cross-template test now fails if the web-side names ever drift from the jobs package definitions.
- `quark update --scaffold-check` no longer crashes on projects that ran `quark add mobile`. `mobile` is a post-creation-only feature, so it is stripped before the reference scaffold is requested instead of being forwarded to a subprocess that rejects it.
- `quark update --scaffold-check` no longer reports guaranteed false drift. The reference scaffold is now built with the project's brief and harness (detected from its skill directory), so projects with a custom `--prompt` or a non-default `--harness` compare byte-for-byte.
- When the reference scaffold cannot be built, the check now fails with a single clear error line and exit code 1 instead of an unhandled stack trace.
- The jobs-omitted warning now also names the skipped signup welcome emails, and `scaffold-warning`/`scaffold-drift` tests are wired into `pnpm test`.
