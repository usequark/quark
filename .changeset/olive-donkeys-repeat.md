---
"@usequark/quark-core": patch
"@usequark/quark-create-app": patch
---

Move the published npm packages from the `@techstream` scope to `@usequark`,
matching the GitHub organisation the project now lives under.

- `@techstream/quark-core` -> `@usequark/quark-core`
- `@techstream/quark-create-app` -> `@usequark/quark-create-app`

**No runtime or API change.** `quark-core` keeps all 17 `exports` subpaths
resolving to byte-identical files, and the CLI keeps the same four `bin` names
(`quark`, `quark-create-app`, `create-quark-app`, `quark-update`), so only the
install specifier changes:

```bash
npm install @usequark/quark-core
npx @usequark/quark-create-app
```

Scaffolded projects are unaffected in shape — the local-only workspace packages
(`db`, `jobs`, `ui`, `config`) are still rewritten to your own scope — but the
published `quark-core` dependency a new project receives is now
`@usequark/quark-core`.

The `@techstream` packages remain installable and are not being unpublished. If
you are still on them, switch when convenient:

```bash
npm install @usequark/quark-core@latest
```