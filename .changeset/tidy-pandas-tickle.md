---
"@usequark/quark-create-app": patch
---

Fix `pnpm lint` failing on a freshly scaffolded project.

The scaffolded `biome.json` shipped `"root": false`. With that key Biome looks
for a root configuration in ancestor directories; a standalone scaffold has
none, so Biome falls back to its built-in defaults and **applies none of the
project's own config**. Three consequences, all observed on a real scaffold:

- `files.includes` negations stop excluding anything, so the Prisma client under
  `packages/db/src/generated` gets linted
- `vcs.useIgnoreFile` is not honoured, so gitignored files are checked
- `css.parser.tailwindDirectives` is unset, so every Tailwind at-rule in
  `globals.css` reports `Tailwind-specific syntax is disabled` and formatting
  aborts with it

Measured with the scaffold's real per-package lint script: 1 of 7 packages failed
before the change, 0 of 7 after. At the project root the fix drops the checked
file count from 157 to 137 on a tree with a planted `src/generated`.

The key is now absent rather than falsy, and the generator deletes it if the
monorepo config ever grows one, so the template cannot drift back.
`packages/cli/src/template-config.test.js` asserts no `root` key,
`tailwindDirectives: true`, `useIgnoreFile: true` and the generated-client
exclusion.

`apps/web/biome.json` **keeps** `root: false`. It `extends` the project config,
and with both keys absent Biome rejects the setup as a nested root
configuration — verified, it exits before checking a single file.