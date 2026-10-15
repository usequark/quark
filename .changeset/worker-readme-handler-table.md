---
"@usequark/quark-create-app": patch
---

Generate the worker README's job-handler table from `JOB_NAMES` instead of hand-maintaining it: `pnpm sync-readme` (in `apps/worker`) rewrites the marked block via `apps/worker/src/readme-table.js`, and `apps/worker/src/readme-consistency.test.js` fails when a job name has no registered handler or when the README table disagrees with the job definitions. The table listed `send-push-notification` / `handleSendPushNotification` as registered, but no such handler file exists and `handlers/index.js` registers exactly the four real jobs; the contradictory row and warning are removed, and the missing `send-verify-email` row is added. Docs and tests only — no runtime behaviour changes.
