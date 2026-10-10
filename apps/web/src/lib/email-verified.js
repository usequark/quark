/**
 * Whether a provider's `email_verified` claim says the address is confirmed.
 *
 * Providers disagree on the wire format. Google's `tokeninfo` endpoint reports
 * the claim as the *string* `"true"` or `"false"`; the OIDC userinfo that
 * reaches a NextAuth profile mapper carries the same string. The id token's own
 * claim is a boolean. A plain truthiness check would therefore do the exact
 * opposite of the obvious thing: accept `"false"` while refusing every real
 * sign-in. Both spellings mean the same thing and both are accepted; nothing
 * else is.
 *
 * Everything else — a missing claim, a null, a number, `"yes"` — reads as
 * unverified, because the failure modes are asymmetric. A wrong refusal costs
 * one unlucky sign-in. A wrong acceptance hands an unconfirmed address a
 * session on a route or a provider that creates the account on first sight.
 *
 * Shared by both Google sign-in paths — the hand-written `POST /api/auth/google`
 * the mobile app posts to, and the NextAuth provider the web button uses — so
 * there is one definition of "confirmed" rather than two that can drift.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEmailVerified(value) {
	if (typeof value === "boolean") return value;
	if (typeof value !== "string") return false;
	return value.trim().toLowerCase() === "true";
}
