---
"@techstream/quark-create-app": patch
---

Fix git hooks when a Quark project is scaffolded inside an existing git repository (monorepo, Conductor workspace).

- `quark create` no longer creates a nested git repository when the target directory is already inside a git work tree; the enclosing repository tracks the project instead. Set `QUARK_FORCE_GIT_INIT=true` to opt into a separate nested repository.
- The scaffolded `scripts/prepare.js` now registers nested projects in a shared dispatcher: git runs hooks from the repository root, so each project's commands are executed from its own directory. Multiple nested Quark projects compose instead of overwriting each other, hooks owned by other tools are never overwritten or deleted, and hooks are no-ops in checkouts that do not contain the project.
- The scaffolded `biome.json` is marked as a non-root configuration so Biome resolves it correctly when the project lives below the repository root.
- `quark create` now warns that GitHub only runs workflows stored at the repository root when the project is nested, with the remediation steps for enabling CI.
- The scaffolded `scripts/check-loading.mjs` audit now detects DB-backed pages (it previously matched an un-substituted placeholder and always passed).
- AI prompts in the scaffolded home page use resolvable package names, and the remaining placeholders are substituted in `MAIN.md`, `.env.railway.example`, `.railway/railway.ts`, and the embedded skills.
- `quark add` and `quark update` scope their uncommitted-changes guard to the project directory, so dirty sibling files in a parent repository no longer block the commands.
- The scaffolded `scripts/check-standards.mjs` is synced from the monorepo, so it allows `apps/mobile` TypeScript after `quark add mobile`.
