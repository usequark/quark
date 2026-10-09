/**
 * OAuth provider configuration.
 *
 * Every provider here is optional. Nothing in Quark requires an OAuth client
 * id, so an app that never enables social sign-in reads `undefined` from these
 * helpers and is unaffected.
 *
 * The contract the auth routes depend on: a provider is either fully
 * configured or it is *off*. There is no third state in which a route serves
 * requests with a weakened trust check. A caller that reaches
 * `/api/auth/google` without `GOOGLE_CLIENT_ID` set gets a refusal, not an
 * unverified login — the route is a public endpoint, so "nobody configured it"
 * is not a reason to leave it serving.
 *
 * The client id is the `aud` claim on the id token the provider issues, which
 * is what binds a token to *this* deployment. Without it, a token minted by any
 * other app registered with the same provider verifies fine and would be
 * accepted here.
 */

/**
 * Reads a client id, treating a blank value as unset.
 *
 * A variable set to `""` or whitespace survives `process.env` but is not a
 * usable client id. Treating it as configured would turn the audience check
 * into a comparison against the empty string and reject every real token,
 * which reads as "sign-in is broken" rather than "sign-in is off".
 *
 * @param {string | undefined} value
 * @returns {string | undefined} The trimmed id, or undefined when blank.
 */
function readClientId(value) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

/**
 * The Google OAuth client id, or undefined when Google sign-in is not configured.
 *
 * @returns {string | undefined}
 */
export function getGoogleClientId() {
	return readClientId(process.env.GOOGLE_CLIENT_ID);
}

/**
 * The Apple Services ID, or undefined when Apple sign-in is not configured.
 *
 * @returns {string | undefined}
 */
export function getAppleClientId() {
	return readClientId(process.env.APPLE_CLIENT_ID);
}

/**
 * Whether Google sign-in is enabled on this deployment.
 *
 * @returns {boolean}
 */
export function isGoogleAuthEnabled() {
	return Boolean(getGoogleClientId());
}

/**
 * Whether Apple sign-in is enabled on this deployment.
 *
 * @returns {boolean}
 */
export function isAppleAuthEnabled() {
	return Boolean(getAppleClientId());
}

/**
 * Compares a token's `aud` claim against the expected client id.
 *
 * Used for Google, where the token is verified out of process by the provider's
 * own introspection endpoint and the claims arrive as parsed JSON. Apple
 * verifies the signature locally, so its audience is passed to `jwtVerify`
 * instead and never comes through here.
 *
 * @param {unknown} actual - The `aud` claim from the verified token.
 * @param {string | undefined} expected - The configured client id.
 * @returns {boolean} False when either side is missing, so an unconfigured
 *   deployment cannot pass by accident.
 */
export function isAudienceValid(actual, expected) {
	if (typeof actual !== "string" || actual === "") {
		return false;
	}
	if (typeof expected !== "string" || expected === "") {
		return false;
	}
	return actual === expected;
}
