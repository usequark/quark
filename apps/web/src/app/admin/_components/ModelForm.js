"use client";

import { isEditable } from "@techstream/quark-admin/field-map";
import { Button } from "@techstream/quark-ui";
import { useActionState } from "react";
import { adminCreate, adminDelete, adminUpdate } from "../_actions/crud";
import FieldRenderer from "./FieldRenderer";

const initialState = { error: null };

/**
 * Generic form for creating or editing a model record.
 *
 * @param {{
 *   model: object,
 *   slug: string,
 *   record?: object,
 *   readOnly?: boolean
 * }} props
 */
export default function ModelForm({ model, slug, record, readOnly = false }) {
	const isEdit = !!record;

	const action = isEdit
		? adminUpdate.bind(null, slug, record.id)
		: adminCreate.bind(null, slug);

	const [state, formAction, isPending] = useActionState(
		async (_prev, formData) => {
			try {
				await action(formData);
				return { error: null };
			} catch (err) {
				return { error: err?.message ?? "An error occurred" };
			}
		},
		initialState,
	);

	const editableFields = model.fields.filter(isEditable);

	return (
		<div className="max-w-2xl">
			<form action={formAction} className="space-y-5">
				{editableFields.map((field) => (
					<FieldRenderer
						key={field.name}
						field={field}
						value={record?.[field.name] ?? undefined}
						disabled={readOnly}
					/>
				))}

				{!readOnly && (
					<div className="flex items-center gap-3 pt-4 border-t border-gray-200">
						<Button type="submit" disabled={isPending}>
							{isPending ? "Saving…" : isEdit ? "Save changes" : "Create"}
						</Button>
						<a
							href={`/admin/${slug}`}
							className="text-sm text-gray-500 hover:text-gray-700"
						>
							Cancel
						</a>
					</div>
				)}

				{state?.error && (
					<p className="text-sm text-red-600 mt-2">{state.error}</p>
				)}
			</form>

			{isEdit && !readOnly && model.fields.some((f) => f.isId) && (
				<form
					action={adminDelete.bind(null, slug, record.id)}
					className="mt-8 pt-6 border-t border-gray-200"
				>
					<p className="text-sm text-gray-500 mb-3">Danger zone</p>
					<Button
						type="submit"
						variant="destructive"
						onClick={(e) => {
							if (!confirm(`Delete this ${model.name}? This cannot be undone.`))
								e.preventDefault();
						}}
					>
						Delete {model.name}
					</Button>
				</form>
			)}
		</div>
	);
}
