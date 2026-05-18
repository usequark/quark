"use client";

import { getInputType, isEditable } from "@techstream/quark-admin/field-map";
import { Button } from "@techstream/quark-ui";
import { useActionState } from "react";
import { adminCreate, adminDelete, adminUpdate } from "../_actions/crud";
import FieldRenderer from "./FieldRenderer";

const initialState = { error: null };

const GROUP_ORDER = [
	"identity",
	"content",
	"configuration",
	"timing",
	"flags",
	"advanced",
];

const GROUP_LABELS = {
	identity: {
		title: "Primary details",
		description: "Name and key identifiers for this record.",
	},
	content: {
		title: "Content",
		description: "Long-form copy and descriptive fields.",
	},
	configuration: {
		title: "Configuration",
		description: "Status, type, and behavior settings.",
	},
	timing: {
		title: "Scheduling and dates",
		description: "Time-based values and publishing windows.",
	},
	flags: {
		title: "Visibility and toggles",
		description: "Boolean switches that change record behavior.",
	},
	advanced: {
		title: "Advanced data",
		description: "Structured and numeric values for power users.",
	},
};

const IDENTITY_NAME_HINTS = [
	"name",
	"title",
	"slug",
	"email",
	"username",
	"first",
	"last",
	"label",
	"key",
];

const CONTENT_NAME_HINTS = [
	"content",
	"body",
	"description",
	"summary",
	"excerpt",
	"notes",
	"bio",
];

const CONFIG_NAME_HINTS = [
	"status",
	"role",
	"type",
	"category",
	"state",
	"visibility",
	"priority",
	"locale",
	"template",
];

const TIMING_NAME_HINTS = [
	"date",
	"time",
	"start",
	"end",
	"publish",
	"schedule",
	"deadline",
	"expires",
];

function hasNameHint(fieldName, hints) {
	return hints.some((hint) => fieldName.includes(hint));
}

function getFieldGroup(field) {
	const inputType = getInputType(field);
	const fieldName = field.name.toLowerCase();

	if (inputType === "checkbox") return "flags";

	if (
		inputType === "richtext" ||
		inputType === "textarea" ||
		hasNameHint(fieldName, CONTENT_NAME_HINTS)
	) {
		return "content";
	}

	if (inputType === "json" || inputType === "number") return "advanced";

	if (
		inputType === "datetime-local" ||
		hasNameHint(fieldName, TIMING_NAME_HINTS)
	) {
		return "timing";
	}

	if (inputType === "select" || hasNameHint(fieldName, CONFIG_NAME_HINTS)) {
		return "configuration";
	}

	if (hasNameHint(fieldName, IDENTITY_NAME_HINTS)) return "identity";

	return "identity";
}

function getGroupLayout(groupKey) {
	if (groupKey === "content" || groupKey === "advanced") return "space-y-5";
	if (groupKey === "flags") return "grid gap-4 sm:grid-cols-2";
	return "grid gap-5 md:grid-cols-2";
}

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
	const formId = `admin-model-form-${slug}-${isEdit ? "edit" : "new"}`;

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

	const groups = {};
	for (const field of editableFields) {
		const group = getFieldGroup(field);
		if (!groups[group]) groups[group] = [];
		groups[group].push(field);
	}

	const activeGroups = GROUP_ORDER.filter(
		(groupKey) => groups[groupKey]?.length > 0,
	);

	return (
		<div className="max-w-6xl">
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<form id={formId} action={formAction} className="space-y-4">
					{activeGroups.map((groupKey) => (
						<section
							key={groupKey}
							className="rounded-[--radius-default] border border-border bg-surface p-4 shadow-sm sm:p-5"
						>
							<div className="mb-4 border-b border-border pb-3">
								<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
									{GROUP_LABELS[groupKey].title}
								</h2>
								<p className="mt-1 text-sm text-text-faint">
									{GROUP_LABELS[groupKey].description}
								</p>
							</div>
							<div className={getGroupLayout(groupKey)}>
								{groups[groupKey].map((field) => (
									<FieldRenderer
										key={field.name}
										field={field}
										value={record?.[field.name] ?? undefined}
										disabled={readOnly}
									/>
								))}
							</div>
						</section>
					))}

					{state?.error && (
						<p className="rounded-[--radius-default] border border-danger/40 bg-danger-muted px-4 py-3 text-sm text-danger">
							{state.error}
						</p>
					)}
				</form>

				{!readOnly && (
					<div className="space-y-4 lg:sticky lg:-top-2 lg:self-start">
						<div className="rounded-[--radius-default] border border-border bg-surface p-4 shadow-sm sm:p-5">
							<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
								Actions
							</p>
							<div className="mt-3 flex flex-col gap-3">
								<Button
									type="submit"
									form={formId}
									disabled={isPending}
									className="w-full justify-center"
								>
									{isPending ? "Saving…" : isEdit ? "Save changes" : "Create"}
								</Button>
								<Button
									type="button"
									variant="danger"
									className="w-full justify-center"
									onClick={() => {
										window.location.href = `/admin/${slug}`;
									}}
								>
									Cancel
								</Button>
							</div>
						</div>

						{isEdit && model.fields.some((f) => f.isId) && (
							<div className="rounded-[--radius-default] border border-danger/30 bg-surface p-4 shadow-sm sm:p-5">
								<p className="text-xs font-semibold uppercase tracking-widest text-danger">
									Danger zone
								</p>
								<p className="mt-1 text-sm text-text-faint">
									Delete this record permanently. This action cannot be undone.
								</p>
								<form
									action={adminDelete.bind(null, slug, record.id)}
									className="mt-4"
								>
									<Button
										type="submit"
										variant="danger"
										onClick={(e) => {
											if (
												!confirm(
													`Delete this ${model.name}? This cannot be undone.`,
												)
											) {
												e.preventDefault();
											}
										}}
									>
										Delete {model.name}
									</Button>
								</form>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
