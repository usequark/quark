---
"@usequark/quark-create-app": patch
---

Remove the dead push-notification pipeline end to end.

The device-register endpoint, the worker's push handler, and the mobile app's token registration all targeted a `Device` model that has never existed in the base schema — `POST /api/device/register` 500'd on every request and every `SEND_PUSH_NOTIFICATION` job threw a TypeError. `quark add mobile` patched the model into project schemas at add-time, but the routes ship in the base template, so every default scaffold carried a dead endpoint. A hand-built test double hid all of it behind a green suite.

Removed: `POST /api/device/register` (route + test), the worker push handler (APNs/FCM via `jose`), `JOB_QUEUES.PUSH` and `JOB_NAMES.SEND_PUSH_NOTIFICATION` from the scaffolded jobs package, the mobile app's `lib/notifications.ts`/`AuthGate` push registration, the `Device`-model schema patch in `quark add mobile`, the APNs/FCM next-steps hint, and the now-unneeded `jose`, `expo-device`, and `expo-notifications` dependencies. `docs/API.md` and `docs/QUARK_USAGE.md` updated to match.

The scaffolded `csrf` test's Bearer-skip fixture now uses `/api/files` instead of the deleted route, and `mobile-template.test.js` (updated, previously unwired) is wired into the CLI test suite.
