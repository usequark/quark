import { UnauthorizedError } from "@bobnoddle/quark-core";
import { auth } from "./auth";

export async function requireAuth() {
	const session = await auth();

	if (!session) {
		throw new UnauthorizedError(
			"You must be logged in to access this resource",
		);
	}

	return session;
}
