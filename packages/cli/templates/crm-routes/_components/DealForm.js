"use client";

import { Button, Input, Label, Select, Textarea } from "@techstream/quark-ui";
import Link from "next/link";
import { useActionState } from "react";
import { createDeal, updateDeal } from "../_actions/deals";

/**
 * Derive a human-readable label from a camelCase field key.
 * e.g. "firstName" → "First Name", "expectedCloseDate" → "Expected Close Date"
 * @param {string} key
 * @returns {string}
 */
function humanize(key) {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (s) => s.toUpperCase())
		.replace(/Id$/, "")
		.trim();
}

export default function DealForm({
	config,
	deal,
	contacts = [],
	companies = [],
}) {
	const action = deal ? updateDeal.bind(null, deal.id) : createDeal;
	const [state, dispatch] = useActionState(action, {});

	const stageDefs = config.pipelineStages;
	const fields = config.fields.entity;
	const errors = state?.errors ?? {};
	const defaultStage = stageDefs[0]?.key ?? "LEAD";

	return (
		<form action={dispatch} className="space-y-6">
			<div className="space-y-4 max-w-xl">
				{fields.map((field) => (
					<ConfigField
						key={field.key}
						field={field}
						deal={deal}
						errors={errors}
						config={config}
						stageDefs={stageDefs}
						defaultStage={defaultStage}
						contacts={contacts}
						companies={companies}
					/>
				))}
			</div>

			<div className="flex items-center gap-3 pt-4 border-t border-border">
				<Button type="submit">
					{deal ? "Save Changes" : `Create ${config.entityLabel}`}
				</Button>
				<Link
					href="/admin/crm/deals"
					className="text-sm text-text-muted hover:text-text"
				>
					Cancel
				</Link>
			</div>
		</form>
	);
}

function ConfigField({
	field,
	deal,
	errors,
	config,
	stageDefs,
	defaultStage,
	contacts,
	companies,
}) {
	const error = errors[field.key];
	const label = resolveFieldLabel(field, config);

	if (field.type === "textarea") {
		return (
			<FieldWrapper label={label} error={error}>
				<Textarea
					name={field.key}
					defaultValue={deal?.[field.key] ?? ""}
					rows={4}
					placeholder={`Any additional ${label.toLowerCase()}...`}
				/>
			</FieldWrapper>
		);
	}

	if (field.type === "select" && field.key === "stage") {
		return (
			<FieldWrapper label={label} error={error}>
				<Select
					name={field.key}
					defaultValue={deal?.stage ?? defaultStage}
					required={field.required}
				>
					{stageDefs.map((s) => (
						<option key={s.key} value={s.key}>
							{s.label} ({s.probability}%)
						</option>
					))}
				</Select>
			</FieldWrapper>
		);
	}

	if (field.type === "select" && field.relation === "actor") {
		return (
			<FieldWrapper label={label} error={error}>
				<Select name={field.key} defaultValue={deal?.[field.key] ?? ""}>
					<option value="">No {config.actorLabel}</option>
					{contacts.map((c) => (
						<option key={c.id} value={c.id}>
							{c.firstName} {c.lastName}
							{c.company ? ` (${c.company.name})` : ""}
						</option>
					))}
				</Select>
			</FieldWrapper>
		);
	}

	if (field.type === "select" && field.relation === "container") {
		return (
			<FieldWrapper label={label} error={error}>
				<Select name={field.key} defaultValue={deal?.[field.key] ?? ""}>
					<option value="">No {config.containerLabel}</option>
					{companies.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</Select>
			</FieldWrapper>
		);
	}

	if (field.type === "date") {
		return (
			<FieldWrapper label={label} error={error}>
				<Input
					name={field.key}
					type="date"
					defaultValue={
						deal?.[field.key]
							? new Date(deal[field.key]).toISOString().split("T")[0]
							: ""
					}
				/>
			</FieldWrapper>
		);
	}

	if (field.type === "number") {
		const defaultValue =
			deal != null
				? String(deal[field.key] ?? field.default ?? "")
				: String(field.default ?? "0");

		return (
			<FieldWrapper label={label} error={error}>
				<Input
					name={field.key}
					type="number"
					min={field.min != null ? String(field.min) : undefined}
					max={field.max != null ? String(field.max) : undefined}
					step={field.step != null ? String(field.step) : undefined}
					defaultValue={defaultValue}
					required={field.required}
					placeholder={field.step === "0.01" ? "0.00" : undefined}
				/>
			</FieldWrapper>
		);
	}

	// text, email, and default
	return (
		<FieldWrapper label={label} error={error}>
			<Input
				name={field.key}
				type={field.type === "email" ? "email" : "text"}
				defaultValue={deal?.[field.key] ?? ""}
				required={field.required}
				placeholder={
					field.key === "title" ? `e.g. ${config.entityLabel}` : undefined
				}
			/>
		</FieldWrapper>
	);
}

function resolveFieldLabel(field, config) {
	if (field.label) return field.label;
	if (field.relation === "actor") return config.actorLabel;
	if (field.relation === "container") return config.containerLabel;
	return humanize(field.key);
}

function FieldWrapper({ label, error, children }) {
	return (
		<div>
			<Label>{label}</Label>
			{children}
			{error && (
				<p className="text-xs text-red-500 mt-1">
					{Array.isArray(error) ? error[0] : error}
				</p>
			)}
		</div>
	);
}
