"use client";
import { useId, useState } from "react";
import { Button } from "./button.js";
import { Input } from "./input.js";
import { Label } from "./label.js";
import { Select } from "./select.js";
import { Textarea } from "./textarea.js";

/**
 * Walks a fields array and collects all leaf field descriptors (excludes rows
 * and submit entries) so we can build the initial values map.
 */
function collectLeafFields(fields) {
	return fields.flatMap((f) => {
		if (f.type === "row") return collectLeafFields(f.fields ?? []);
		if (f.type === "submit") return [];
		return [f];
	});
}

function buildInitialValues(fields) {
	return Object.fromEntries(
		collectLeafFields(fields).map((f) => [f.name, f.defaultValue ?? ""]),
	);
}

function getFieldKey(field) {
	if (field.name) {
		return field.name;
	}

	if (field.type === "row") {
		const childKeys = (field.fields ?? []).map(getFieldKey).join("|");
		return `row:${childKeys}:${field.hint ?? ""}`;
	}

	if (field.type === "submit") {
		return `submit:${field.label ?? "submit"}`;
	}

	return `${field.type}:${field.label ?? field.placeholder ?? "field"}`;
}

/** Renders the appropriate input element for a single field descriptor. */
function FieldInput({ field, value, onChange, id }) {
	const { type, placeholder, required, name } = field;

	if (type === "textarea") {
		return (
			<Textarea
				id={id}
				name={name}
				placeholder={placeholder}
				required={required}
				rows={field.rows ?? 4}
				value={value}
				onChange={(e) => onChange(name, e.target.value)}
			/>
		);
	}

	if (type === "dropdown") {
		return (
			<Select
				id={id}
				name={name}
				placeholder={placeholder ?? "Choose…"}
				required={required}
				value={value}
				onChange={(e) => onChange(name, e.target.value)}
			>
				{(field.options ?? []).map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</Select>
		);
	}

	// text | number
	return (
		<Input
			id={id}
			name={name}
			type={type === "number" ? "number" : "text"}
			placeholder={placeholder}
			required={required}
			value={value}
			onChange={(e) => onChange(name, e.target.value)}
		/>
	);
}

/** A labelled wrapper around a single field input. */
function FormField({ field, values, onChange }) {
	const generatedId = useId();
	const fieldId = generatedId;

	return (
		<div className="min-w-0 space-y-1.5">
			{field.label && <Label htmlFor={fieldId}>{field.label}</Label>}
			<FieldInput
				field={field}
				value={values[field.name] ?? ""}
				onChange={onChange}
				id={fieldId}
			/>
		</div>
	);
}

/**
 * Config-driven form component.
 *
 * `fields` is an array of field descriptors. Each descriptor is one of:
 *
 *   - `{ type: 'text' | 'number', name, label?, placeholder?, required?, defaultValue? }`
 *   - `{ type: 'textarea', name, label?, placeholder?, rows?, required?, defaultValue? }`
 *   - `{ type: 'dropdown', name, label?, placeholder?, options: [{value, label}], required?, defaultValue? }`
 *   - `{ type: 'row', fields: [...], hint? }` — renders child fields side by side
 *   - `{ type: 'submit', label? }` — renders the submit button inline in the flow
 *
 * `onSubmit(values)` is called with a flat `{ [name]: value }` map on submission.
 * `submitLabel` is used when no explicit `submit` field is present in the fields array.
 * `showSubmit` (default true) appends an auto submit button when there is no explicit
 *   `submit` entry in `fields`.
 */
export function Form({
	fields = [],
	onSubmit,
	submitLabel = "Submit",
	showSubmit = true,
	className = "",
}) {
	const [values, setValues] = useState(() => buildInitialValues(fields));

	const hasExplicitSubmit = fields.some((f) => f.type === "submit");

	function handleChange(name, value) {
		setValues((prev) => ({ ...prev, [name]: value }));
	}

	function handleSubmit(e) {
		e.preventDefault();
		onSubmit?.(values);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className={`space-y-4 ${className}`.trim()}
			noValidate={false}
		>
			{fields.map((field) => {
				// ── Row ──────────────────────────────────────────────────────────
				if (field.type === "row") {
					const cols = field.fields?.length ?? 1;
					return (
						<div key={getFieldKey(field)} className="space-y-1">
							<div
								className="grid gap-3"
								style={{
									gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
								}}
							>
								{(field.fields ?? []).map((subField) => (
									<FormField
										key={getFieldKey(subField)}
										field={subField}
										values={values}
										onChange={handleChange}
									/>
								))}
							</div>
							{field.hint && (
								<p className="text-xs text-text-muted">{field.hint}</p>
							)}
						</div>
					);
				}

				// ── Submit ───────────────────────────────────────────────────────
				if (field.type === "submit") {
					return (
						<Button
							key={getFieldKey(field)}
							type="submit"
							variant="primary"
							className="w-full"
						>
							{field.label ?? submitLabel}
						</Button>
					);
				}

				// ── Standard field ───────────────────────────────────────────────
				return (
					<FormField
						key={getFieldKey(field)}
						field={field}
						values={values}
						onChange={handleChange}
					/>
				);
			})}

			{/* Auto submit button when no explicit submit field exists */}
			{!hasExplicitSubmit && showSubmit && (
				<Button type="submit" variant="primary" className="w-full">
					{submitLabel}
				</Button>
			)}
		</form>
	);
}
