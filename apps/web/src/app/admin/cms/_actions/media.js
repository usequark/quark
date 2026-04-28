"use server";

import { cmsConfig } from "@techstream/quark-cms";
import { createStorage, ValidationError } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";

const storage = createStorage();

const uploadSchema = z.object({
	alt: z.string().max(200).optional().or(z.literal("")),
});

/**
 * Server Action: upload a file to storage and create a MediaAsset record.
 * @param {FormData} formData
 */
export async function cmsUploadMedia(_prevState, formData) {
	const session = await requireRole("admin");

	const file = formData.get("file");
	if (!(file instanceof File) || file.size === 0) {
		throw new ValidationError("No file provided");
	}

	const { maxFileSize, allowedTypes } = cmsConfig.media;

	if (file.size > maxFileSize) {
		throw new ValidationError(
			`File size exceeds the ${Math.round(maxFileSize / 1024 / 1024)}MB limit`,
		);
	}

	if (!allowedTypes.includes(file.type)) {
		throw new ValidationError(`File type "${file.type}" is not allowed`);
	}

	const altResult = uploadSchema.safeParse({ alt: formData.get("alt") });
	const alt = altResult.success ? altResult.data.alt || null : null;

	// Generate a unique storage key: cms/<timestamp>-<random>/<filename>
	const _ext = file.name.split(".").pop() ?? "";
	const rand = Math.random().toString(36).slice(2, 8);
	const storageKey = `cms/${Date.now()}-${rand}/${file.name}`;

	const buffer = Buffer.from(await file.arrayBuffer());
	await storage.put(storageKey, buffer, { contentType: file.type });

	await prisma.mediaAsset.create({
		data: {
			filename: file.name,
			storageKey,
			mimeType: file.type,
			size: file.size,
			alt,
			uploadedById: session.user.id,
		},
	});

	revalidatePath("/admin/cms/media");
	redirect("/admin/cms/media");
}

/**
 * Server Action: delete a MediaAsset and remove from storage.
 * Any admin can delete any media asset — the CMS media library is a shared
 * resource accessible to all admins (no per-user ownership enforcement).
 * @param {string} id
 */
export async function cmsDeleteMedia(id) {
	await requireRole("admin");

	const asset = await prisma.mediaAsset.findUnique({ where: { id } });
	if (!asset) return;

	await storage.delete(asset.storageKey);
	await prisma.mediaAsset.delete({ where: { id } });

	revalidatePath("/admin/cms/media");
	redirect("/admin/cms/media");
}
