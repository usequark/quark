"use client";

import { getInputType } from "@techstream/quark-admin";
import { Checkbox, Input, Label, Select, Textarea } from "@techstream/quark-ui";

/**
 * Format a DateTime value for use in a datetime-local input.
 * @param {unknown} value
 * @returns {string}
 */
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
 * Render a form field based on its Prisma type.
 *
 * @param {{ field: object, value?: unknown, disabled?: boolean }} props
 */
export default function FieldRenderer({ field, value, disabled = false }) {
	const inputType = getInputType(field);

	if (inputType === "hidden" || inputType === "relation") {
		return null;
	}

	const id = `field-${field.name}`;
	const label = field.name;
	const required = field.isRequired && !field.hasDefaultValue;

	if (inputType === "checkbox") {
		return (
			<div className="flex flex-col gap-1">
				<Checkbox
					id={id}
					name={field.name}
					label={label}
					defaultChecked={!!value}
					disabled={disabled}
				/>
			</div>
		);
	}

	if (inputType === "select") {
		const options = field.enumValues ?? [];
		return (
			<div className="flex flex-col gap-1">
				<Label htmlFor={id}>
					{label}
					{required && " *"}
				</Label>
				<Select
					id={id}
					name={field.name}
					defaultValue={value ?? ""}
					disabled={disabled}
					required={required}
				>
					{!required && <option value="">— none —</option>}
					{options.map((opt) => (
						<option key={opt} value={opt}>
							{opt}
						</option>
					))}
				</Select>
			</div>
		);
	}

	if (inputType === "textarea" || inputType === "json") {
		return (
			<div className="flex flex-col gap-1">
				<Label htmlFor={id}>
					{label}
					{required && " *"}
				</Label>
				<Textarea
					id={id}
					name={field.name}
					defaultValue={
						inputType === "json" && value !== undefined && value !== null
							? JSON.stringify(value, null, 2)
							: (value ?? "")
					}
					disabled={disabled}
					required={required}
					rows={inputType === "json" ? 6 : 4}
					placeholder={inputType === "json" ? "JSON…" : undefined}
				/>
			</div>
		);
	}

	if (inputType === "datetime-local") {
		return (
			<div className="flex flex-col gap-1">
				<Label htmlFor={id}>
					{label}
					{required && " *"}
				</Label>
				<Input
					id={id}
					type="datetime-local"
					name={field.name}
					defaultValue={formatDatetimeLocal(value)}
					disabled={disabled}
					required={required}
				/>
			</div>
		);
	}

	// text, email, number
	return (
		<div className="flex flex-col gap-1">
			<Label htmlFor={id}>
				{label}
				{required && " *"}
			</Label>
			<Input
				id={id}
				type={inputType}
				name={field.name}
				defaultValue={value ?? ""}
				disabled={disabled}
				required={required}
			/>
		</div>
	);
}
