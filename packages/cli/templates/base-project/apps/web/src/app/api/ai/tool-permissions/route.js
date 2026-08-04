import { validateBody } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

const accessLevelEnum = z.enum(["auto", "confirm", "disabled"]);

const bulkUpdateSchema = z.object({
	permissions: z.array(
		z.object({
			toolName: z.string().min(1),
			accessLevel: accessLevelEnum,
		}),
	),
});

export async function GET(_request) {
	try {
		const session = await requireAuth();
		const permissions = await prisma.aiToolPermission.findMany({
			where: { userId: session.user.id },
		});
		return NextResponse.json({ data: permissions });
	} catch (error) {
		return handleError(error);
	}
}

export async function PUT(request) {
	try {
		const session = await requireAuth();
		const data = await validateBody(request, bulkUpdateSchema);

		const operations = data.permissions.map((perm) =>
			prisma.aiToolPermission.upsert({
				where: {
					userId_toolName: {
						userId: session.user.id,
						toolName: perm.toolName,
					},
				},
				update: { accessLevel: perm.accessLevel },
				create: {
					userId: session.user.id,
					toolName: perm.toolName,
					accessLevel: perm.accessLevel,
				},
			}),
		);

		await prisma.$transaction(operations);

		const updated = await prisma.aiToolPermission.findMany({
			where: { userId: session.user.id },
		});

		return NextResponse.json({ data: updated });
	} catch (error) {
		return handleError(error);
	}
}
