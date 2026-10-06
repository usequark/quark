---
"@usequark/quark-create-app": patch
---

Fix two documentation lies in the scaffolded project entry points, and pin them
with tests.

`MAIN.md` and `README.md` hardcoded `http://localhost:3000` as the "start here"
link, but the CLI resolves a free port with `findAvailablePort(3000)` and writes
the result to `PORT` in the generated `.env`. Whenever 3000 was already taken the
docs sent the user to a server that was never started. The port logic itself was
correct; only the docs disagreed with it. Both files now render the port from a
new `__QUARK_WEB_PORT__` placeholder, so the link always matches the `.env` that
was actually generated.

`MAIN.md`'s "Read this first" list pointed at `openapi.yaml`. Nothing in the
scaffold creates that file — the only one in this repository is `docs/openapi.yaml`
in the Quark monorepo, which is never shipped. An agent that follows `MAIN.md`
before anything else is told to read a file that does not exist. Removed.

Neither bug was reachable by a test, which is how both survived: the CLI already
had a suite that scaffolds a real project and checks the output
(`scaffold-output.test.js`), but it asserted on placeholders and package scopes,
never on whether a documented path resolves or a documented port matches `.env`.
Three assertions added there — the doc templates may not contain a literal
`localhost:3000`, the scaffolded docs must link to the port in the generated
`.env`, and every path in MAIN.md's "Read this first" section must exist in the
scaffold output. The port check is made against the template rather than the
rendered output on purpose: in a rendered project `localhost:3000` is the correct
link whenever 3000 happens to be free, so an output-only assertion would be
environment-dependent and would not have caught the original bug. Verified to
fail 2 of 12 when both bugs are restored.