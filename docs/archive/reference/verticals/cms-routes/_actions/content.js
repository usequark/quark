"use server";

import {
	archiveContent,
	ensureUniqueSlug,
	publishContent,
	unpublishContent,
} from "@techstream/quark-cms";
import { prisma } from "@techstream/quark-db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth-middleware";
import { revalidatePublicContent } from "@/lib/public-content-revalidation.js";
import { parsePageFormData, resolvePageSlugCandidate } from "./page-form.js";

// ─── Shared schemas ──────────────────────────────────────────────────────────

// ─── Page actions ─────────────────────────────────────────────────────────────

export async function cmsCreatePage(_prevState, formData) {
	const session = await requireRole(["admin", "editor"]);

	const {
		title,
		slug: rawSlug,
		body,
		excerpt,
		layout,
		showHeader,
		content,
	} = parsePageFormData(formData);
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
			layout,
			showHeader,
			content,
			authorId: session.user.id,
		},
	});

	await revalidatePublicContent();
	revalidatePath("/admin/cms/pages");
	redirect("/admin/cms/pages?toast=created");
}

export async function cmsUpdatePage(id, _prevState, formData) {
	await requireRole(["admin", "editor"]);

	const {
		title,
		slug: rawSlug,
		body,
		content,
		excerpt,
		layout,
		showHeader,
	} = parsePageFormData(formData);
	const slugCandidate = resolvePageSlugCandidate({ title, slug: rawSlug });
	const slug = await ensureUniqueSlug(prisma, "Page", slugCandidate, id);

	await prisma.page.update({
		where: { id },
		data: {
			title,
			slug,
			body,
			content,
			excerpt: excerpt || null,
			layout,
			showHeader,
		},
	});

	await revalidatePublicContent();
	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
	redirect("/admin/cms/pages?toast=updated");
}

export async function cmsPublishPage(id) {
	await requireRole(["admin", "editor"]);
	await publishContent(prisma, "Page", id);
	await revalidatePublicContent();
	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
}

export async function cmsArchivePage(id) {
	await requireRole(["admin", "editor"]);
	await archiveContent(prisma, "Page", id);
	await revalidatePublicContent();
	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
}

export async function cmsUnpublishPage(id) {
	await requireRole(["admin", "editor"]);
	await unpublishContent(prisma, "Page", id);
	await revalidatePublicContent();
	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
}

export async function cmsDeletePage(id) {
	await requireRole(["admin", "editor"]);
	await prisma.page.delete({ where: { id } });
	await revalidatePublicContent();
	revalidatePath("/admin/cms/pages");
	redirect("/admin/cms/pages?toast=deleted");
}
