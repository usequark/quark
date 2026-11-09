# Recommended Future Work

Status as of 2026-11-09, validated against `origin/main`, npm, and the live
site. Source: the post-release review of *Quark Path to a Viable Alternative*.
Everything security- and release-related from that review is closed in code
(findings A–E + drift, semver policy, `UPGRADING.md`, positioning line) and
live (`@usequark/quark-create-app@1.27.4`, site deploy healthy). What remains
is listed below in priority order, with the gate that keeps each item honest.

Do not start items 6–7 before items 4–5 produce adoption evidence — that
ordering is the point of the original document.

## 1. Publish the security advisory for the refresh-token hole (now, blocked on access)

Finding A (mobile refresh tokens reissued from the stale token payload with no
database read) was live on a public site and is fixed in
`@usequark/quark-create-app@1.27.0` (PR #290), but no GitHub security advisory
was ever published. The full draft is in the appendix below — creation via API
returned 403 (token lacks security-advisory write), so a maintainer must paste
it into GitHub → Security → Advisories → New draft advisory, review, and
Publish (request a CVE at the same time if desired).

## 2. Auth direction decision (decision only, no code)

Stay on Auth.js under Better Auth's stewardship, or cost the migration to
Better Auth. This gates all future auth work either way, and the original
document says to make it only after adoption evidence exists. Deliverable is a
short decision record, not a branch.

## 3. Wave-4 cosmetic drift cleanup on `quark-site` (optional, schedulable)

The security backport (site PRs #23–#25) closed the substantive drift; what
remains is cosmetic. Last measured during the backport: missing template files
19 → 3, remainder cosmetic. Run the full `quark update` only in a quiet window
— it rewrites custom landing/docs content, so it wants its own PR and a visual
check. No security content; safe to schedule anytime or never.

## 4. Proof app #2 (scope exists, build not started)

The document wants two or three real apps on the published CLI before any
expensive bet. One exists (the site upgrade write-up at
`usequark.dev/docs/security-updates`). The scoping notes from the review call
for the second app to:

- ship the Expo client — mobile refresh and the drift check are the unproven
  paths, and a web-only app proves nothing new;
- scaffold from the published CLI with a registry `quarkVersion`, not a local
  path (the site's local link is exactly what this avoids);
- gate on drift-check exit 0 **with** mobile installed, plus a live
  demotion/revocation smoke on device.

Non-goals are listed in the scoping notes to keep it days, not weeks. Defects
found become quark issues, never local forks.

## 5. Rotate the ZeptoMail API key (operational, two minutes)

The ZeptoMail token used to provision the site mailer was pasted into a chat
transcript and must be treated as burned: generate a fresh key in ZeptoMail,
swap the Railway worker variable, and confirm a password-reset email still
delivers. Independent of everything else; either order works.

## 6. Passive adoption watch (observe, do not act)

The binding constraint is adoption evidence, and there is nothing to do but
notice: stars (1) / forks (0) at last check, npm download trend, external
issues and PRs, a second contributor. Record movement here when it happens;
items 2 and 7 unlock when this moves.

## 7. Phase 4 bets — do not start before items 4–5 land

- Type declarations for `@usequark/quark-core`.
- Skill evaluation harness.
- Opt-down profile for small projects.
- Auth-migration costing (item 2), if the decision is "migrate".

Each of these spends real effort against an adoption curve that does not exist
yet (item 6). The original document is explicit that they wait.

---

## Appendix: security advisory draft (ready to paste)

**Package:** npm · `@usequark/quark-create-app` · **vulnerable:** `< 1.27.0` ·
**patched:** `1.27.0` · **Severity:** Moderate · **CWE:** CWE-613 (Insufficient
Session Expiration)

### Title

Quark scaffolded apps reissue mobile refresh tokens without a database check,
so password reset or role demotion does not invalidate a stolen refresh token

### Summary

Quark apps scaffolded by `@usequark/quark-create-app` prior to `1.27.0` reissue
mobile refresh tokens without consulting the database, so revoking access
(password reset, role demotion, account deletion) does not kill a live refresh
token.

### Details

`POST /api/auth/refresh` in the scaffolded `apps/web` app minted a new
access/refresh token pair by copying `email`, `name` and `role` from the **old
token payload**. Signature, issuer and expiry were verified, but no database
read occurred, and `REFRESH_TOKEN_EXPIRY` defaults to `30d`.

### Impact

An attacker holding a stolen mobile refresh token could retain access for up to
30 days even after the victim reset their password or was demoted from an
administrative role. Exploitation requires a previously stolen refresh token
(device theft, malicious app with storage access, etc.).

### Patches

Fixed in `@usequark/quark-create-app@1.27.0` (usequark/quark#290): the refresh
route now re-derives `id`, `email`, `name` and `role` from the database row,
rejects deleted users, and rejects tokens issued before `passwordChangedAt`.
Existing projects should update the CLI and run `quark update`, or port
`apps/web/src/app/api/auth/refresh/route.js` from the template.

### Workarounds

- Set a short `REFRESH_TOKEN_EXPIRY` (e.g. `1h`) in the affected app to shrink
  the window.
- Disable the mobile refresh route if the app does not ship a mobile client.

### References

- https://github.com/usequark/quark/pull/290
- https://usequark.dev/docs/security-updates
