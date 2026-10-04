# Support

## Where to ask

| I want to... | Go to |
|---|---|
| Ask a question or start a discussion | [Discussions](https://github.com/usequark/quark/discussions) |
| Report a bug | [Open an issue](https://github.com/usequark/quark/issues/new/choose) |
| Suggest a feature | [Open a feature request](https://github.com/usequark/quark/issues/new/choose) |
| Report a vulnerability | [Private vulnerability reporting](https://github.com/usequark/quark/security/advisories/new) — **not** a public issue |
| Contribute code | Read [CONTRIBUTING.md](CONTRIBUTING.md) first |

Support is provided by volunteers in GitHub Discussions. There is no guaranteed
response time, and there is no paid support offering.

## Before you ask

You will get a faster answer if you can answer these yourself:

1. **Search first.** [Discussions](https://github.com/usequark/quark/discussions) and
   [closed issues](https://github.com/usequark/quark/issues?q=is%3Aissue+is%3Aclosed)
   cover most recurring questions.
2. **Check the docs.** [docs/START_HERE.md](docs/START_HERE.md) is the current
   onboarding path; [docs/INDEX.md](docs/INDEX.md) indexes everything else.
3. **Confirm your versions.** `node --version`, your OS, and the exact version of
   the package you are using. Quark requires **Node 22 or newer**.
4. **Check if it is your app, not Quark.** Code you generate with the CLI becomes
   yours to maintain. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for what
   Quark owns versus what your application owns.

## Common questions

**Which version am I running?**

```bash
npm ls @usequark/quark-core @usequark/quark-create-app
```

**How do I get Quark updates in an existing project?**

```bash
npx @usequark/quark-create-app update
```

**How do I update the CLI itself?**

```bash
npm install -g @usequark/quark-create-app@latest
```

**Something is broken after an update. What should I include in a report?**

The exact command you ran, the full error output with secrets removed, your Node
version, and the `create` command or flags used to scaffold the project. See the
[bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).

## Reporting a code of conduct violation

Do not open a public issue. Follow the reporting process in
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
