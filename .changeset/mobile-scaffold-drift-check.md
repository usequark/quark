---
"@usequark/quark-create-app": minor
---

Scope `update --scaffold-check` by installed feature so a project that has run `add mobile` no longer fails the check on a false positive.

`add mobile` appends the mobile block (`# --- Mobile App ---` / `EXPO_PUBLIC_API_URL`) to the scaffold-managed root `.env.example`, but `create` rejects `mobile`, so the reference scaffold the check rebuilds could never carry it. The byte comparison is unscoped by feature, so every mobile project failed `update --scaffold-check --fail-on-drift` with `Scaffold drift detected in 1 file(s): .env.example`.

The reference scaffold now replays the mobile-specific root edits when `mobile` is recorded in `.quark-link.json`, so those lines are expected rather than drift. This does not weaken detection: the edits are constants, so editing or deleting the mobile block — or any other managed line — is still reported.

Migration: none required. No project files change. A mobile project that previously failed the check because of this false positive passes once it updates `@usequark/quark-create-app`; projects with genuine drift are unaffected.
