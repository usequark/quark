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
 * Splits a comma-separated audience list into individual ids, trimming each
 * and dropping blanks. Returns undefined when the whole value is blank.
 *
 * @param {string | undefined} value
 * @returns {string[] | undefined}
 */
function readClientIdList(value) {
	const ids = (value ?? "")
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
	return ids.length > 0 ? ids : undefined;
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
 * The Apple OAuth audience(s), or undefined when Apple sign-in is not configured.
 *
 * Apple identity tokens can carry *either* the bundle identifier (native iOS)
 * *or* the Services ID (web flow) as their `aud` claim — which one depends on
 * how the client was registered and which flow it uses. A single-value audience
 * would reject one of the two, so this returns a list.
 *
 * @returns {string[] | undefined}
 */
export function getAppleClientIds() {
	return readClientIdList(process.env.APPLE_CLIENT_ID);
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
	return Boolean(getAppleClientIds());
}

/**
 * Compares a token's `aud` claim against the expected client id(s).
 *
 * Used for Google, where the token is verified out of process by the provider's
 * own introspection endpoint and the claims arrive as parsed JSON. Apple
 * verifies the signature locally, so its audience is passed to `jwtVerify`
 * instead and never comes through here.
 *
 * Accepts either a single id or an array. For Apple, pass the full list from
 * `getAppleClientIds()` so both the bundle identifier and the Services ID are
 * accepted.
 *
 * @param {unknown} actual - The `aud` claim from the verified token.
 * @param {string | string[] | undefined} expected - The configured client id(s).
 * @returns {boolean} False when either side is missing, so an unconfigured
 *   deployment cannot pass by accident.
 */
export function isAudienceValid(actual, expected) {
	if (typeof actual !== "string" || actual === "") {
		return false;
	}

	if (Array.isArray(expected)) {
		if (expected.length === 0) return false;
		return expected.includes(actual);
	}

	if (typeof expected !== "string" || expected === "") {
		return false;
	}
	return actual === expected;
}
