"use server";

import { dealSchema } from "@techstream/quark-crm";
import { prisma } from "@techstream/quark-db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth-middleware";

export async function createDeal(_prevState, formData) {
	await requireRole(["admin", "editor"]);

	const raw = Object.fromEntries(formData.entries());
	const parsed = dealSchema.safeParse(raw);
	if (!parsed.success) {
		return { errors: parsed.error.flatten().fieldErrors };
	}

	const {
		title,
		value,
		stage,
		probability,
		expectedCloseDate,
		notes,
		contactId,
		companyId,
	} = parsed.data;

	await prisma.deal.create({
		data: {
			title,
			value,
			stage,
			probability,
			expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
			notes: notes || null,
			contactId: contactId || null,
			companyId: companyId || null,
		},
	});

	revalidatePath("/admin/crm/deals");
	redirect("/admin/crm/deals");
}

export async function updateDeal(id, _prevState, formData) {
	await requireRole(["admin", "editor"]);

	const raw = Object.fromEntries(formData.entries());
	const parsed = dealSchema.safeParse(raw);
	if (!parsed.success) {
		return { errors: parsed.error.flatten().fieldErrors };
	}

	const {
		title,
		value,
		stage,
		probability,
		expectedCloseDate,
		notes,
		contactId,
		companyId,
	} = parsed.data;

	await prisma.deal.update({
		where: { id },
		data: {
			title,
			value,
			stage,
			probability,
			expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
			notes: notes || null,
			contactId: contactId || null,
			companyId: companyId || null,
		},
	});

	revalidatePath("/admin/crm/deals");
	revalidatePath(`/admin/deal/${id}`);
	redirect("/admin/crm/deals");
}

export async function moveDealStage(id, stage) {
	await requireRole(["admin", "editor"]);

	await prisma.deal.update({
		where: { id },
		data: { stage },
	});

	revalidatePath("/admin/crm/deals");
	revalidatePath("/admin/crm/deals/pipeline");
}

export async function deleteDeal(id) {
	await requireRole(["admin"]);

	await prisma.deal.delete({ where: { id } });

	revalidatePath("/admin/crm/deals");
	redirect("/admin/crm/deals");
}
