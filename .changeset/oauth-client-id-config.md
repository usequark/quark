---
"@usequark/quark-create-app": patch
---

feat(config): declare the OAuth client ids so the auth routes can bind tokens to this app

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `GITHUB_ID` and
`GITHUB_SECRET` were read directly from `process.env` but declared nowhere: not
in the env schema, not in `ENV_DESCRIPTIONS`, not in any `.env.example`. An
operator setting them got no validation, no documentation of their effect, and
no signal when half a provider was configured.

They are now optional schema fields, so an app that never enables social
sign-in is unaffected. New helpers on `@usequark/quark-config/oauth` —
`getGoogleClientId`, `getAppleClientId`, `isGoogleAuthEnabled`,
`isAppleAuthEnabled`, `isAudienceValid` — give the auth routes one place to ask
whether a provider is configured and to compare a token's audience against the
configured client id.

Two behaviours are pinned here, ahead of the routes using them:

- A blank or whitespace-only client id reads as *not configured*. Counting it as
  configured would compare every token against the empty string and reject all
  of them, presenting as "sign-in is broken" rather than "sign-in is off".
- `isAudienceValid` returns false when the expected client id is missing. A
  caller that forgets to gate on enablement fails closed rather than open.

Startup now warns when a GitHub or Google client id is set without its secret
(or the reverse). `auth.js` registers a NextAuth provider only when both halves
are present, so a half-configured provider hides the sign-in button with nothing
to explain why.

`.env.example` and the Railway example no longer describe OAuth as "Not Yet
Implemented" — the routes have shipped and are reachable. They now name the
client ids the `/api/auth/google` and `/api/auth/apple` routes bind tokens to,
and `TROUBLESHOOTING.md` covers the two failure modes this makes diagnosable: a
half-configured provider hiding the sign-in button, and a mobile client id that
does not match the server's.

The routes themselves are unchanged, and the docs say so rather than describing
behaviour that does not exist yet. Applying the audience check — and gating each
route on its client id so an unconfigured deployment refuses rather than serving
a weakened check — is the next change.