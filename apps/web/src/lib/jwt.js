import { getAuthSecret } from "@techstream/quark-core";
import { jwtVerify, SignJWT } from "jose";

const ISSUER = "quark-mobile";
const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "30d";

/**
 * Get the shared secret key for signing/verifying mobile JWTs.
 * Returns null if NEXTAUTH_SECRET is not configured.
 */
function getSecretKey() {
	const secret = getAuthSecret();
	if (!secret) return null;
	return new TextEncoder().encode(secret);
}

/**
 * Issue an access + refresh token pair for a user.
 * @param {{ id: string, email: string, name: string | null, role: string }} user
 * @returns {{ token: string, refreshToken: string, expiresAt: string }}
 */
export async function issueTokenPair(user) {
	const secretKey = getSecretKey();
	if (!secretKey) throw new Error("NEXTAUTH_SECRET not configured");

	const now = Math.floor(Date.now() / 1000);

	const [token, refreshToken] = await Promise.all([
		new SignJWT({
			sub: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
		})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt(now)
			.setExpirationTime(ACCESS_TOKEN_EXPIRY)
			.setIssuer(ISSUER)
			.sign(secretKey),
		new SignJWT({
			sub: user.id,
			type: "refresh",
		})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt(now)
			.setExpirationTime(REFRESH_TOKEN_EXPIRY)
			.setIssuer(ISSUER)
			.sign(secretKey),
	]);

	const expiresAt = new Date(now * 1000 + 60 * 60 * 1000).toISOString();
	return { token, refreshToken, expiresAt };
}

/**
 * Verify a mobile JWT and return its payload.
 * @param {string} token
 * @returns {Promise<import("jose").JWTPayload | null>} payload or null if invalid
 */
export async function verifyMobileToken(token) {
	const secretKey = getSecretKey();
	if (!secretKey) return null;

	try {
		const result = await jwtVerify(token, secretKey, { issuer: ISSUER });
		return result.payload;
	} catch {
		return null;
	}
}

/**
 * Extract and verify a Bearer token from a Request's Authorization header.
 * @param {Request} request
 * @returns {Promise<import("jose").JWTPayload | null>} payload or null if missing/invalid
 */
export async function extractBearerPayload(request) {
	const authHeader = request.headers.get("authorization");
	if (!authHeader?.startsWith("Bearer ")) return null;

	const token = authHeader.slice(7);
	return verifyMobileToken(token);
}
