## What this changes

<!-- One or two sentences. What is different after this merges? -->

## Why

<!-- The problem this solves, or a link to the issue it closes. -->

Closes #

## How it was verified

<!--
Do not just say "tests pass". Say what you actually did:

- the commands you ran
- a new project you scaffolded and tried
- the failure you reproduced before the fix
-->

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] Scaffolded a fresh project and ran it

## Checklist

- [ ] A changeset is included (`pnpm changeset`) — required for any change to a published package
- [ ] No secrets, tokens, or `.env` values in the diff
- [ ] New or changed code follows the standards in [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md)
      (ESM only, Zod validation, `AppError`/`ValidationError`, `createLogger`, Biome)
- [ ] Tests are co-located next to the code they cover
- [ ] If I touched `apps/web`, `apps/worker`, `packages/db`, `packages/config`, `packages/ui`, or `packages/jobs`, I ran `pnpm --filter @usequark/quark-create-app sync-templates` and committed the result
- [ ] Documentation updated where behaviour changed

## Notes for reviewers

<!--
Anything a reviewer should know before reading the diff: trade-offs you made,
places you are unsure about, or areas you deliberately left out.
-->
