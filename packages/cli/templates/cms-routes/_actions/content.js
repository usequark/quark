"use server";

import {
	archiveContent,
	ensureUniqueSlug,
	generateSlug,
	publishContent,
	unpublishContent,
} from "@techstream/quark-cms";
import { prisma } from "@techstream/quark-db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth-middleware";
import { parsePageFormData } from "./page-form.js";

// ─── Shared schemas ──────────────────────────────────────────────────────────

// ─── Page actions ─────────────────────────────────────────────────────────────

export async function cmsCreatePage(_prevState, formData) {
	const session = await requireRole(["admin", "editor"]);

	const { title, slug: rawSlug, body, excerpt } = parsePageFormData(formData);
	const slug = await ensureUniqueSlug(
		prisma,
		"Page",
		rawSlug || generateSlug(title),
	);

	await prisma.page.create({
		data: {
			title,
			slug,
			body,
			excerpt: excerpt || null,
			authorId: session.user.id,
		},
	});

	revalidatePath("/admin/cms/pages");
	redirect("/admin/cms/pages");
}

export async function cmsUpdatePage(id, _prevState, formData) {
	await requireRole(["admin", "editor"]);

	const { title, slug: rawSlug, body, excerpt } = parsePageFormData(formData);
	const slug = await ensureUniqueSlug(
		prisma,
		"Page",
		rawSlug || generateSlug(title),
		id,
	);

	await prisma.page.update({
		where: { id },
		data: { title, slug, body, excerpt: excerpt || null },
	});

	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
	redirect("/admin/cms/pages");
}

export async function cmsPublishPage(id) {
	await requireRole(["admin", "editor"]);
	await publishContent(prisma, "Page", id);
	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
}

export async function cmsArchivePage(id) {
	await requireRole(["admin", "editor"]);
	await archiveContent(prisma, "Page", id);
	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
}

export async function cmsUnpublishPage(id) {
	await requireRole(["admin", "editor"]);
	await unpublishContent(prisma, "Page", id);
	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
}

export async function cmsDeletePage(id) {
	await requireRole(["admin", "editor"]);
	await prisma.page.delete({ where: { id } });
	revalidatePath("/admin/cms/pages");
	redirect("/admin/cms/pages");
}
