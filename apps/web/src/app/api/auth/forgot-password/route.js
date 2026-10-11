import {
	createLogger,
	validateBody,
	withCsrfProtection,
} from "@usequark/quark-core/core";
import { user } from "@usequark/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendResetPasswordEmail } from "@/lib/send-reset-password-email";
import { handleError } from "../../error-handler";

const logger = createLogger("auth:forgot-password");

const forgotPasswordSchema = z.object({
	email: z.string().email("Invalid email address"),
});

/**
 * The response for every request, registered address or not.
 *
 * Replying differently for unknown addresses turns this route into an
 * email-enumeration oracle: the difference between "no such user" and "check
 * your inbox" is exactly the information a spammer or a spear-phisher is
 * probing for. The same 200 with the same body is also what the rate limiter
 * needs — a distinguishable error path would let an attacker distinguish
 * "limited" from "not a valid address" from the outside.
 */
const NEUTRAL_RESPONSE = {
	message: "If that email address has an account, a reset link is on its way.",
};

export const POST = withCsrfProtection(async (request) => {
	try {
		const { email } = await validateBody(request, forgotPasswordSchema);

		const account = await user.findByEmail(email);

		if (account) {
			try {
				await sendResetPasswordEmail(account);
			} catch (error) {
				// The address exists; the answer must still be the neutral one. A
				// failure here is operational (token issue or queue down), so it is
				// logged where an operator can see it and deliberately not surfaced
				// to the caller.
				logger.error("Failed to send password reset email", {
					userId: account.id,
					message: error?.message ?? String(error),
				});
			}
		}

		return NextResponse.json(NEUTRAL_RESPONSE);
	} catch (error) {
		return handleError(error);
	}
});
