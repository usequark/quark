---
"@usequark/quark-create-app": patch
---

fix(auth): bind OAuth sign-in tokens to this deployment

`POST /api/auth/google` and `POST /api/auth/apple` verified that a token was
genuine and then minted a first-party session for whatever address it carried.
Neither checked the token's audience, so an id token Google or Apple issued to a
*different* app for the victim's address was accepted here.

The exploit needs no stolen credential. The attacker gets the victim to sign in
to any app registered with the same provider — one they control — and posts the
resulting token to this route. The signature verifies, `findByEmail` finds the
victim, and the attacker is logged in as them. Google guarantees the `email`
claim belongs to the token's subject, which is precisely what makes it usable.

Three changes, all fail-closed:

- **`aud` is checked against the configured client id.** Google via
  `tokeninfo.aud`; Apple by passing `audience` to `jwtVerify`, which enforces it
  during verification.
- **Both routes return `503` when no client id is configured.** These routes are
  public — nothing about them requires your frontend to call them, or anyone to
  have enabled social sign-in — so "nobody configured it" is not a reason to
  keep serving. Serving unconfigured meant accepting tokens with no audience check
  at all, strictly weaker than the configured case that at least returns 401.
- **Apple's `nonce` is no longer discarded.** The client sends a raw nonce and
  hands Apple its SHA-256 digest; the route re-hashes what it received and
  compares in constant time. The claim is required rather than optional, because
  a token with no `nonce` proves nothing about which sign-in attempt it came
  from, and treating "client sent no nonce" as "skip the check" would leave
  Apple's replay defence off for any caller who simply omits the field.

Every rejection returns one generic `401`. A distinct message for an audience
mismatch or a nonce mismatch tells an attacker their forged token was
structurally valid and names the check left to work around.

The two `KNOWN GAP` tests that recorded this are inverted into assertions that
the token is refused and that no user row and no token are created. Each new
guard is mutation-tested: removing the audience comparison fails 4 Google and 3
Apple tests, removing the 503 gate fails 2 each, removing the nonce checks fails
4, and removing the blank-trim guard in the config accessor fails 2.

`GET /api/auth/apple` now requires `nonce` in the request body. The bundled
mobile client already sends one.

Apple's `APPLE_CLIENT_ID` accepts a comma-separated list of audiences. Native
iOS identity tokens carry the bundle identifier as `aud`; web-flow tokens carry
the Services ID. A single-value audience would reject one of the two, so both
are accepted when configured as a list. `getAppleClientIds()` in
`@usequark/quark-config/oauth` returns the parsed list and `isAudienceValid`
accepts either a single id or an array.

Behaviour change: an app with no OAuth client id configured can no longer use
these endpoints. That is the point — but it is a change, so set the client id
before deploying if you rely on mobile sign-in.