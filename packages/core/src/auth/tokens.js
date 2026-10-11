import crypto from "node:crypto";

/**
 * @usequark/quark-core - Verification Token Helpers
 *
 * The primitives behind email-verification and password-reset links, kept in
 * one place so both flows agree on how a token is minted and how it is stored.
 */

/** 32 bytes of entropy, rendered as 64 hex characters. */
export const DEFAULT_TOKEN_BYTES = 32;

/**
 * Generates a cryptographically random token for a one-time link.
 *
 * `randomBytes` is CSPRNG-backed — unlike `Math.random` or a timestamp, its
 * output cannot be predicted from a sample. The token is the entire bearer
 * credential in the emailed URL, so predictability is the whole attack.
 *
 * Hex rather than base64url because the token is both placed in a URL query
 * string and stored in a database column; hex needs no percent-encoding and
 * survives a copy/paste through an email client without case surprises.
 *
 * @param {number} [bytes=DEFAULT_TOKEN_BYTES] - Entropy in bytes
 * @returns {string} Hex-encoded token
 */
export function generateToken(bytes = DEFAULT_TOKEN_BYTES) {
	return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Hashes a token for storage.
 *
 * The database is not the place to keep a credential that grants account
 * access: a leaked dump, a backup, or a read-only reporting replica would hand
 * an attacker a working reset link for every pending request. What is stored is
 * the SHA-256 digest, so a leaked row cannot be redeemed. The emailed, raw
 * token is the only copy that can be.
 *
 * A plain SHA-256 is sufficient here, unlike for passwords: the input is 256
 * bits of uniform randomness, so brute-forcing the preimage is infeasible and
 * there is nothing for a slow, salted KDF to defend against.
 *
 * @param {string} token - Raw token
 * @returns {string} Hex-encoded SHA-256 digest
 */
export function hashToken(token) {
	return crypto.createHash("sha256").update(String(token)).digest("hex");
}
