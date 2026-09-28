---
"@techstream/quark-create-app": patch
---

Stop the lifecycle E2E from hanging after it passes

`test-e2e-full` launches the scaffolded app with `spawn("pnpm", ["dev"])`,
which starts a process tree (pnpm -> turbo -> next dev). Cleanup only sent
`SIGTERM` to the pnpm pid, so the grandchildren survived holding the stdio
pipes and the parent process never exited. The E2E job sat idle for ~9 minutes
after printing `Total Duration: 41.53s` and every phase passing, until GitHub
killed it at `timeout-minutes: 10` and reported the job as *cancelled* rather
than failed.

The dev server now runs in its own process group (`detached: true`) and
cleanup signals the whole group, escalating to `SIGKILL` if anything ignores
`SIGTERM`. Verified the group signal reaches and reaps the tree.
