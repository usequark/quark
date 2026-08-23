---
"@techstream/quark-create-app": patch
---

fix(cli): make ui a required package so minimal scaffolds work

The base web app (layout, auth, example-page) imports the `ui` package, but a
minimal scaffold (`--features ""` or `--preset minimal`) did not include it,
producing a broken scaffold that failed `pnpm doctor:ci`. `ui` is now always
scaffolded (alongside `db` and `config`), and the web app dependency + `.quark-link.json`
reflect it so the doctor check passes.
