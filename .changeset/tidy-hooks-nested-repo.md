---
"@techstream/quark-create-app": patch
---

Fix git hooks when a Quark project is scaffolded inside an existing git repository (monorepo, Conductor workspace).

- `quark create` no longer creates a nested git repository when the target directory is already inside a git work tree; the enclosing repository tracks the project instead. Set `QUARK_FORCE_GIT_INIT=true` to opt into a separate nested repository.
- The scaffolded `scripts/prepare.js` now registers nested projects in a shared dispatcher: git runs hooks from the repository root, so each project's commands are executed from its own directory. Multiple nested Quark projects compose instead of overwriting each other, hooks owned by other tools are never overwritten or deleted, and hooks are no-ops in checkouts that do not contain the project.
- The scaffolded `biome.json` is marked as a non-root configuration so Biome resolves it correctly when the project lives below the repository root.
