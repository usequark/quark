"use server";

import {
	adminConfig,
	coerceId,
	createRecord,
	deleteRecord,
	getModelBySlug,
	hasIdField,
	isEditable,
	updateRecord,
} from "@techstream/quark-admin";
import {
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth-middleware";

/**
 * Coerce raw form data values to the correct types for a Prisma model.
 * @param {import('@techstream/quark-admin').Model} model
 * @param {FormData} formData
 * @returns {Record<string, unknown>}
 */
function extractFormData(model, formData) {
	const data = {};
	for (const field of model.fields) {
		if (!isEditable(field)) continue;
		const raw = formData.get(field.name);

		if (raw === null || raw === "") {
			if (field.isRequired && !field.hasDefaultValue) {
				throw new ValidationError(`${field.name} is required`);
			}
			// Prisma 7 rejects null for non-nullable fields with defaults —
			// omit the field entirely so Prisma applies the default.
			if (field.hasDefaultValue) continue;
			data[field.name] = null;
			continue;
		}

		switch (field.type) {
			case "Int":
			case "Float":
			case "Decimal":
			case "BigInt":
				data[field.name] = Number(raw);
				break;
			case "Boolean":
				data[field.name] = raw === "on" || raw === "true";
				break;
			case "DateTime":
				data[field.name] = new Date(raw);
				break;
			case "Json":
				try {
					data[field.name] = JSON.parse(raw);
				} catch {
					data[field.name] = raw;
				}
				break;
			default:
				data[field.name] = raw;
		}
	}

	// Convert FK scalar fields to Prisma relation syntax.
	// Prisma 7 rejects scalar FK fields (e.g. `clientId`) — they must be
	// expressed as `client: { connect: { id: "..." } }`.
	for (const field of model.fields) {
		if (field.kind !== "scalar") continue;
		if (field.name === "id") continue;
		if (!field.name.endsWith("Id")) continue;
		if (!(field.name in data) || data[field.name] === null) continue;
		const relationName =
			field.name.charAt(0).toLowerCase() + field.name.slice(1, -2);
		data[relationName] = { connect: { id: data[field.name] } };
		delete data[field.name];
	}

	return data;
}

/**
 * Server Action: create a new record for a model.
 * @param {string} slug - URL slug for the model
 * @param {FormData} formData
 */
export async function adminCreate(slug, formData) {
	await requireRole("admin");

	const model = getModelBySlug(slug);
	if (!model || !hasIdField(model)) throw new NotFoundError("Model not found");

	const overrides = adminConfig.modelOverrides[model.name] ?? {};
	if (overrides.readOnly) throw new ForbiddenError("Model is read-only");

	const data = extractFormData(model, formData);
	await createRecord(prisma, model.name, data);

	revalidatePath(`/admin/${slug}`);
	redirect(`/admin/${slug}?toast=created`);
}

/**
 * Server Action: update an existing record.
 * @param {string} slug
 * @param {string} id
 * @param {FormData} formData
 */
export async function adminUpdate(slug, id, formData) {
	await requireRole("admin");

	const model = getModelBySlug(slug);
	if (!model || !hasIdField(model)) throw new NotFoundError("Model not found");

	const overrides = adminConfig.modelOverrides[model.name] ?? {};
	if (overrides.readOnly) throw new ForbiddenError("Model is read-only");

	const data = extractFormData(model, formData);
	await updateRecord(prisma, model.name, coerceId(model, id), data);

	revalidatePath(`/admin/${slug}`);
	revalidatePath(`/admin/${slug}/${id}`);
	redirect(`/admin/${slug}?toast=updated`);
}

/**
 * Server Action: delete a record.
 * @param {string} slug
 * @param {string} id
 */
export async function adminDelete(slug, id) {
	await requireRole("admin");

	const model = getModelBySlug(slug);
	if (!model || !hasIdField(model)) throw new NotFoundError("Model not found");

	const overrides = adminConfig.modelOverrides[model.name] ?? {};
	if (overrides.readOnly) throw new ForbiddenError("Model is read-only");

	await deleteRecord(prisma, model.name, coerceId(model, id));

	revalidatePath(`/admin/${slug}`);
	redirect(`/admin/${slug}?toast=deleted`);
}
