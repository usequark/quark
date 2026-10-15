import { createLogger, validateBody } from "@usequark/quark-core/core";
import { user as userQueries } from "@usequark/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { issueTokenPair, verifyMobileToken } from "../../../../lib/jwt";
import { handleError } from "../../error-handler";

const logger = createLogger("auth-refresh");

const refreshRequestSchema = z.object({
	refreshToken: z.string().min(1),
});

/**
 * The one response every refused refresh gets.
 *
 * A deleted account, a password reset, a forged signature and an expired token
 * are indistinguishable to the caller: they share a status and a body, so a
 * probing client cannot learn which check failed.
 */
function invalidRefreshToken() {
	return NextResponse.json(
		{ message: "Invalid or expired refresh token" },
		{ status: 401 },
	);
}

/**
 * POST /api/auth/refresh
 * Exchange a refresh token for a new access token.
 *
 * A refresh token lives for 30 days, so the identity it was minted with cannot
 * be trusted for that long. This re-reads the current id, email, name and role
 * from the user's row on every exchange — the same revocation contract
 * `validateSessionToken` applies to web sessions — and refuses the exchange
 * when the account is gone or its password changed after the token was issued.
 */
export async function POST(request) {
	try {
		const { refreshToken } = await validateBody(request, refreshRequestSchema);

		const payload = await verifyMobileToken(refreshToken);
		if (!payload) {
			logger.warn("Invalid refresh token");
			return invalidRefreshToken();
		}

		if (payload.type !== "refresh") {
			return NextResponse.json(
				{ message: "Invalid token type" },
				{ status: 401 },
			);
		}

		// A genuine refresh token always carries `sub`; refuse anything else
		// rather than handing `undefined` to the query layer.
		if (typeof payload.sub !== "string" || payload.sub.length === 0) {
			logger.warn("Refresh token has no subject");
			return invalidRefreshToken();
		}

		const account = await userQueries.findById(payload.sub);
		if (!account) {
			// Deleted (or otherwise removed) between issue and exchange. Without
			// this read the route would keep minting access tokens for a ghost.
			logger.warn("Refresh token for an account that no longer exists");
			return invalidRefreshToken();
		}

		// Mirrors `validateSessionToken`: a password reset stamps
		// `passwordChangedAt`, and any token issued before that instant is dead.
		// `iat` is whole seconds; comparing against the millisecond stamp as a
		// fraction keeps a change in the same second from leaking a token.
		if (
			account.passwordChangedAt &&
			typeof payload.iat === "number" &&
			account.passwordChangedAt.getTime() / 1000 > payload.iat
		) {
			logger.warn("Refresh token issued before the password changed");
			return invalidRefreshToken();
		}

		// The claims come from the row, never from the token: a 30-day-old
		// `role` (or any stale profile field) must not be re-stamped onto a fresh
		// access token.
		const { token } = await issueTokenPair({
			id: account.id,
			email: account.email,
			name: account.name,
			role: account.role,
		});

		return NextResponse.json({ token });
	} catch (error) {
		return handleError(error);
	}
}
