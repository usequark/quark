"use server";

import {
	archiveContent,
	ensureUniqueSlug,
	generateSlug,
	publishContent,
	unpublishContent,
} from "@techstream/quark-cms";
import { ValidationError } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";

// ─── Shared schemas ──────────────────────────────────────────────────────────

const pageSchema = z.object({
	title: z.string().min(1, "Title is required").max(200),
	slug: z
		.string()
		.min(1, "Slug is required")
		.max(200)
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must be lowercase letters, numbers, and hyphens only",
		),
	body: z.string().min(1, "Body is required"),
	excerpt: z.string().max(500).optional().or(z.literal("")),
});

const postSchema = pageSchema.extend({
	coverImage: z
		.string()
		.url("Must be a valid URL")
		.optional()
		.or(z.literal("")),
});

// ─── Page actions ─────────────────────────────────────────────────────────────

export async function cmsCreatePage(_prevState, formData) {
	const session = await requireRole("admin");

	const raw = Object.fromEntries(formData);
	const result = pageSchema.safeParse(raw);
	if (!result.success) {
		throw new ValidationError(result.error.issues[0].message);
	}

	const { title, slug: rawSlug, body, excerpt } = result.data;
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
	await requireRole("admin");

	const raw = Object.fromEntries(formData);
	const result = pageSchema.safeParse(raw);
	if (!result.success) {
		throw new ValidationError(result.error.issues[0].message);
	}

	const { title, slug: rawSlug, body, excerpt } = result.data;
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
	await requireRole("admin");
	await publishContent(prisma, "Page", id);
	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
}

export async function cmsArchivePage(id) {
	await requireRole("admin");
	await archiveContent(prisma, "Page", id);
	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
}

export async function cmsUnpublishPage(id) {
	await requireRole("admin");
	await unpublishContent(prisma, "Page", id);
	revalidatePath("/admin/cms/pages");
	revalidatePath(`/admin/cms/pages/${id}`);
}

export async function cmsDeletePage(id) {
	await requireRole("admin");
	await prisma.page.delete({ where: { id } });
	revalidatePath("/admin/cms/pages");
	redirect("/admin/cms/pages");
}

// ─── Post actions ─────────────────────────────────────────────────────────────

export async function cmsCreatePost(_prevState, formData) {
	const session = await requireRole("admin");

	const raw = Object.fromEntries(formData);
	const result = postSchema.safeParse(raw);
	if (!result.success) {
		throw new ValidationError(result.error.issues[0].message);
	}

	const { title, slug: rawSlug, body, excerpt, coverImage } = result.data;
	const slug = await ensureUniqueSlug(
		prisma,
		"Post",
		rawSlug || generateSlug(title),
	);

	await prisma.post.create({
		data: {
			title,
			slug,
			body,
			excerpt: excerpt || null,
			coverImage: coverImage || null,
			authorId: session.user.id,
		},
	});

	revalidatePath("/admin/cms/posts");
	redirect("/admin/cms/posts");
}

export async function cmsUpdatePost(id, _prevState, formData) {
	await requireRole("admin");

	const raw = Object.fromEntries(formData);
	const result = postSchema.safeParse(raw);
	if (!result.success) {
		throw new ValidationError(result.error.issues[0].message);
	}

	const { title, slug: rawSlug, body, excerpt, coverImage } = result.data;
	const slug = await ensureUniqueSlug(
		prisma,
		"Post",
		rawSlug || generateSlug(title),
		id,
	);

	await prisma.post.update({
		where: { id },
		data: {
			title,
			slug,
			body,
			excerpt: excerpt || null,
			coverImage: coverImage || null,
		},
	});

	revalidatePath("/admin/cms/posts");
	revalidatePath(`/admin/cms/posts/${id}`);
	redirect("/admin/cms/posts");
}

export async function cmsPublishPost(id) {
	await requireRole("admin");
	await publishContent(prisma, "Post", id);
	revalidatePath("/admin/cms/posts");
	revalidatePath(`/admin/cms/posts/${id}`);
}

export async function cmsArchivePost(id) {
	await requireRole("admin");
	await archiveContent(prisma, "Post", id);
	revalidatePath("/admin/cms/posts");
	revalidatePath(`/admin/cms/posts/${id}`);
}

export async function cmsUnpublishPost(id) {
	await requireRole("admin");
	await unpublishContent(prisma, "Post", id);
	revalidatePath("/admin/cms/posts");
	revalidatePath(`/admin/cms/posts/${id}`);
}

export async function cmsDeletePost(id) {
	await requireRole("admin");
	await prisma.post.delete({ where: { id } });
	revalidatePath("/admin/cms/posts");
	redirect("/admin/cms/posts");
}
