"use client";

import { getInputType, isEditable } from "@techstream/quark-admin/field-map";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { adminCreate, adminDelete, adminUpdate } from "../_actions/crud";

const initialState = { error: null };

/**
 * Convert camelCase / snake_case / SCREAMING_SNAKE names to readable labels.
 */
function humanize(name) {
	if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
		return name
			.replace(/_/g, " ")
			.toLowerCase()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}
	return name
		.replace(/([A-Z])/g, " $1")
		.replace(/[_-]/g, " ")
		.trim()
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.replace(/\bId\b/g, "ID")
		.replace(/\bUrl\b/g, "URL");
}

function formatDatetimeLocal(value) {
	if (!value) return "";
	try {
		const d = value instanceof Date ? value : new Date(value);
		return d.toISOString().slice(0, 16);
	} catch {
		return "";
	}
}

/**
 * Render a single form field based on its Prisma type. Neutral HTML inputs —
 * no themed UI.
 */
function Field({ field, value, disabled }) {
	const inputType = getInputType(field);
	if (inputType === "hidden" || inputType === "relation") return null;

	const id = `field-${field.name}`;
	const label = humanize(field.name);
	const required = field.isRequired && !field.hasDefaultValue;
	const requiredMark = required ? (
		<span className="ml-0.5 text-red-600" aria-hidden="true">
			*
		</span>
	) : null;

	const labelEl = (
		<label
			htmlFor={id}
			className="block text-sm font-medium text-gray-700 mb-1"
		>
			{label}
			{requiredMark}
		</label>
	);

	const inputClass =
		"w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-500";

	if (inputType === "checkbox") {
		return (
			<div className="flex items-center gap-2">
				<input
					id={id}
					type="checkbox"
					name={field.name}
					defaultChecked={!!value}
					disabled={disabled}
					className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
				/>
				<label htmlFor={id} className="text-sm text-gray-700">
					{label}
				</label>
			</div>
		);
	}

	if (inputType === "select") {
		const options = field.enumValues ?? [];
		return (
			<div>
				{labelEl}
				<select
					id={id}
					name={field.name}
					defaultValue={value ?? ""}
					disabled={disabled}
					required={required}
					className={inputClass}
				>
					{!required && <option value="">- Select an option -</option>}
					{options.map((opt) => (
						<option key={opt} value={opt}>
							{humanize(opt)}
						</option>
					))}
				</select>
			</div>
		);
	}

	if (
		inputType === "textarea" ||
		inputType === "json" ||
		inputType === "richtext"
	) {
		const isJson = inputType === "json";
		return (
			<div>
				{labelEl}
				<textarea
					id={id}
					name={field.name}
					defaultValue={
						isJson && value !== undefined && value !== null
							? JSON.stringify(value, null, 2)
							: (value ?? "")
					}
					disabled={disabled}
					required={required}
					rows={isJson ? 6 : 4}
					className={inputClass}
				/>
			</div>
		);
	}

	return (
		<div>
			{labelEl}
			<input
				id={id}
				type={inputType}
				name={field.name}
				defaultValue={
					inputType === "datetime-local"
						? formatDatetimeLocal(value)
						: (value ?? "")
				}
				disabled={disabled}
				required={required}
				className={inputClass}
			/>
		</div>
	);
}

/**
 * ActionForm pattern — add / update / remove a record for a model.
 *
 * @param {{
 *   model: object,
 *   slug: string,
 *   record?: object,
 *   readOnly?: boolean,
 * }} props
 */
export default function ActionForm({ model, slug, record, readOnly = false }) {
	const isEdit = !!record;
	const formId = `admin-action-form-${slug}-${isEdit ? "edit" : "new"}`;

	const action = isEdit
		? adminUpdate.bind(null, slug, record.id)
		: adminCreate.bind(null, slug);

	const [state, formAction, isPending] = useActionState(
		async (_prev, formData) => {
			try {
				await action(formData);
				return { error: null };
			} catch (err) {
				if (
					typeof err?.digest === "string" &&
					err.digest.startsWith("NEXT_REDIRECT")
				) {
					throw err;
				}
				return { error: err?.message ?? "An error occurred" };
			}
		},
		initialState,
	);

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, startDeleteTransition] = useTransition();

	const editableFields = model.fields.filter(isEditable);

	return (
		<div className="max-w-2xl">
			<form id={formId} action={formAction} className="space-y-4">
				{editableFields.map((field) => (
					<Field
						key={field.name}
						field={field}
						value={record?.[field.name] ?? undefined}
						disabled={readOnly}
					/>
				))}

				{state?.error && (
					<div
						role="alert"
						className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
					>
						{state.error}
					</div>
				)}

				<div className="flex items-center gap-3 pt-2">
					<button
						type="submit"
						form={formId}
						disabled={isPending}
						className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
					>
						{isPending ? "Saving…" : isEdit ? "Save changes" : "Create"}
					</button>
					<Link
						href={`/admin/${slug}`}
						className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</Link>
					{isEdit && !readOnly && (
						<button
							type="button"
							onClick={() => setDeleteOpen(true)}
							className="ml-auto rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
						>
							Delete
						</button>
					)}
				</div>
			</form>

			{deleteOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-md rounded-lg bg-white p-5">
						<h2 className="text-base font-semibold text-gray-900">
							Delete {model.name}
						</h2>
						<p className="mt-2 text-sm text-gray-600">
							Are you sure you want to permanently delete this{" "}
							{model.name.toLowerCase()}? This action cannot be undone.
						</p>
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setDeleteOpen(false)}
								disabled={isDeleting}
								className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={isDeleting}
								onClick={() => {
									startDeleteTransition(async () => {
										await adminDelete(slug, record.id);
									});
								}}
								className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
							>
								{isDeleting ? "Deleting…" : "Yes, delete"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
