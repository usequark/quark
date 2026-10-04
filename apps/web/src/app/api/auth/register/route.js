import {
	createQueue,
	hashPassword,
	validateBody,
	withCsrfProtection,
} from "@usequark/quark-core";
import { user, userRegisterSchema } from "@usequark/quark-db";
import { JOB_NAMES, JOB_QUEUES } from "@usequark/quark-jobs";
import { NextResponse } from "next/server";
import { isSignupEnabled } from "@/lib/auth-signup";
import { handleError } from "../../error-handler";

export const POST = withCsrfProtection(async (request) => {
	if (!isSignupEnabled()) {
		return NextResponse.json(
			{ message: "Registration is disabled." },
			{ status: 403 },
		);
	}

	try {
		const data = await validateBody(request, userRegisterSchema);

		// Check if user exists
		const existing = await user.findByEmail(data.email);
		if (existing) {
			return NextResponse.json(
				{ message: "User with this email already exists" },
				{ status: 409 },
			);
		}

		const hashedPassword = await hashPassword(data.password);

		// Remove password from data before passing to create (create expects plain data object, but we need to inject hashed password)
		// We need to update the user.create method or pass it manually.
		// The current user.create just takes 'data'.

		// Prisma create data:
		const newUser = await user.create({
			email: data.email,
			name: data.name,
			password: hashedPassword,
		});

		// Don't return the password
		const { password: _, ...safeUser } = newUser;

		// Enqueue welcome email (fire-and-forget - don't block the response)
		try {
			const emailQueue = createQueue(JOB_QUEUES.EMAIL);
			await emailQueue.add(JOB_NAMES.SEND_WELCOME_EMAIL, {
				userId: newUser.id,
			});
		} catch {
			// Non-critical - user is created even if email fails to enqueue
		}

		return NextResponse.json(safeUser, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
});
