---
"@usequark/quark-create-app": patch
---

fix(deploy): make `quark deploy railway` generate a Railway IaC file that parses

The generated `.railway/railway.ts` did not compile, so `railway config apply`
could never have succeeded. It failed on two independent syntax faults, both of
which reached every project because nothing in this repo ever evaluated the file
— the Railway CLI does that at apply time, in the user's own account.

**A doubled comma in every service.** The object body was assembled by
concatenating pre-rendered blocks, each of which carried its own separator:

```ts
healthcheckTimeout: 120,,
preDeploy: "pnpm db:migrate:deploy",,
```

`healthcheck` ended with a comma and `env` began with one; `preDeploy` ended
with a comma and `env` began with one. Both services were affected, on every
run — not an edge case. The service body is now a list of complete fields joined
once, which makes the separator unrepresentable.

**Unquoted variable references.** `DATABASE_URL: ${{Postgres.DATABASE_URL}}` is
not a valid expression — `${{` opens an object literal that never closes.
Railway's reference syntax only resolves inside a string. The call sites passed
the bare form because the same expression is correct for
`railway variable set`, where it is a command-line argument rather than an
expression. The IaC path now goes through a new exported `iacRef()` helper that
returns the quoted form; the argument path is unchanged.

Also in this change:

- **`APP_NAME` / `APP_DESCRIPTION` came from the local directory name.** A
  project deployed as `quark-site` from a directory called `minnetonka`
  advertised itself as `minnetonka`, in both the generated IaC and the
  Railway variables. Both now come from the name Railway actually resolved, via
  a new `readLinkedProject()` that also fills in the project name for the
  already-linked path, which previously returned `null`.
- **The SDK install no longer rewrites `package.json` on every deploy.**
  `installRailwaySdk()` skips the `pnpm add` when `railway` already resolves
  (`hasRailwaySdk()`), and passes `-w` explicitly rather than relying on the
  package manager's default. The failure message no longer tells you to run the
  command that just failed.
- **Overwriting `.railway/railway.ts` is now visible.** It is a tracked file
  that every scaffold ships a hand-written copy of, and the deploy replaced it
  silently. `generateIacFile()` now reports whether it changed anything and
  returns the previous content, and the deploy prints a line pointing at
  `git diff`. Identical content is not rewritten at all.

**The gap that let all of this ship** is closed in `src/deploy/adapters/iac.test.js`:
the generated file is now parsed as TypeScript, checked for doubled separators
and bare references, and diffed against the IaC file shipped in
`templates/base-project` so the generator and the scaffold cannot drift. The
existing assertion `content.includes("${{Postgres.DATABASE_URL}}")` passed on
the broken file and pinned the bug; it now requires the quotes. All of these
were verified failing against the previous generator.

This repo's own `.railway/railway.ts` also called `preserve()` four times
without importing it — the exact fault fixed in the scaffold template by #229,
which did not reach this copy. Fixed, and covered by the same test.