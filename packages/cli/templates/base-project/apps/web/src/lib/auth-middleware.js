import { UnauthorizedError } from "@quark/core";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";

export async function requireAuth() {
	const session = await getServerSession(authOptions);

	if (!session) {
		throw new UnauthorizedError(
			"You must be logged in to access this resource",
		);
	}

	return session;
}
