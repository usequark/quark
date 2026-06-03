"use client";

import { getInputType } from "@techstream/quark-admin/field-map";
import {
	Checkbox,
	Input,
	Label,
	RichText,
	Select,
	Textarea,
} from "@techstream/quark-ui";
import AdminImageField from "./AdminImageField";

/**
 * Convert camelCase / snake_case / SCREAMING_SNAKE field names to readable labels.
 * e.g. "firstName" → "First Name", "created_at" → "Created At", "PUBLISHED" → "Published"
 */
function humanize(name) {
	// ALL_CAPS enum values like "PUBLISHED", "IN_PROGRESS"
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
		.replace(/\bUrl\b/g, "URL")
		.replace(/\bApi\b/g, "API")
		.replace(/\bSeo\b/g, "SEO");
}

const PLACEHOLDER_MAP = {
	title: "e.g. About Us, Getting Started",
	name: "e.g. My Record",
	firstName: "e.g. John",
	lastName: "e.g. Smith",
	fullName: "e.g. John Smith",
	email: "e.g. user@example.com",
	phone: "e.g. +1 555 000 0000",
	mobile: "e.g. +1 555 000 0000",
	slug: "e.g. about-us",
	url: "e.g. https://example.com",
	website: "e.g. https://example.com",
	link: "e.g. https://example.com",
	description: "Write a brief description…",
	excerpt: "A short summary for listings and search results…",
	bio: "Tell us about yourself…",
	notes: "Add any notes or additional details…",
	body: "Write your content here…",
	content: "Write your content here…",
	summary: "A brief summary…",
	address: "e.g. 123 Main St",
	city: "e.g. San Francisco",
	country: "e.g. United States",
	zipCode: "e.g. 94102",
	postalCode: "e.g. 94102",
	username: "e.g. johndoe",
	label: "e.g. Primary, Featured",
	key: "e.g. my-unique-key",
};

const HELP_MAP = {
	slug: "Used in the page URL. Lowercase letters, numbers, and hyphens only.",
	excerpt:
		"Shown in listings and search previews. Keep it under 160 characters.",
	status: "Controls whether this record is publicly visible.",
	publishedAt:
		"Leave blank to save as a draft. Set a date to schedule publishing.",
	url: "Include the full address starting with https://",
	website: "Include the full address starting with https://",
	email: "Must be a valid email address.",
	username: "Only letters, numbers, dots, and underscores. No spaces.",
};

/**
 * Return a helpful placeholder string for a field based on its name and input type.
 */
function getPlaceholder(fieldName, inputType) {
	if (PLACEHOLDER_MAP[fieldName]) return PLACEHOLDER_MAP[fieldName];
	const lower = fieldName.toLowerCase();
	if (lower.includes("email")) return "e.g. user@example.com";
	if (
		lower.includes("phone") ||
		lower.includes("mobile") ||
		lower.includes("tel")
	)
		return "e.g. +1 555 000 0000";
	if (
		lower.includes("url") ||
		lower.includes("link") ||
		lower.includes("website")
	)
		return "e.g. https://example.com";
	if (lower.includes("slug")) return "e.g. my-page-slug";
	if (
		lower.includes("description") ||
		lower.includes("excerpt") ||
		lower.includes("summary")
	)
		return "Write a brief description…";
	if (lower.includes("title")) return "Enter a title…";
	if (lower.includes("name")) return "Enter a name…";
	if (inputType === "email") return "e.g. user@example.com";
	if (inputType === "number") return "0";
	return undefined;
}

/**
 * Return contextual help text for a field based on its name.
 */
function getHelpText(fieldName) {
	if (HELP_MAP[fieldName]) return HELP_MAP[fieldName];
	const lower = fieldName.toLowerCase();
	if (lower.includes("slug"))
		return "Used in the page URL. Lowercase letters, numbers, and hyphens only.";
	if (lower.includes("excerpt"))
		return "Shown in listings and search previews.";
	return null;
}

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
	const label = humanize(field.name);
	const required = field.isRequired && !field.hasDefaultValue;
	const placeholder = getPlaceholder(field.name, inputType);
	const helpText = getHelpText(field.name);
	const helpId = helpText ? `${id}-help` : undefined;

	const requiredMark = required ? (
		<span
			className="ml-0.5 text-danger"
			aria-hidden="true"
			title="Required field"
		>
			*
		</span>
	) : null;

	if (inputType === "image") {
		return (
			<AdminImageField
				label={label}
				name={field.name}
				defaultValue={value ?? ""}
				disabled={disabled}
			/>
		);
	}

	if (inputType === "checkbox") {
		return (
			<div className="flex flex-col gap-1.5">
				<Checkbox
					id={id}
					name={field.name}
					label={label}
					defaultChecked={!!value}
					disabled={disabled}
					aria-required={required || undefined}
				/>
				{helpText && (
					<p id={helpId} className="pl-6 text-xs text-text-faint">
						{helpText}
					</p>
				)}
			</div>
		);
	}

	if (inputType === "select") {
		const options = field.enumValues ?? [];
		return (
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={id}>
					{label}
					{requiredMark}
				</Label>
				<Select
					id={id}
					name={field.name}
					defaultValue={value ?? ""}
					disabled={disabled}
					required={required}
					aria-required={required || undefined}
					aria-describedby={helpId}
				>
					{!required && <option value="">— Select an option —</option>}
					{options.map((opt) => (
						<option key={opt} value={opt}>
							{humanize(opt)}
						</option>
					))}
				</Select>
				{helpText && (
					<p id={helpId} className="text-xs text-text-faint">
						{helpText}
					</p>
				)}
			</div>
		);
	}

	if (inputType === "richtext") {
		return (
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={id}>
					{label}
					{requiredMark}
				</Label>
				<RichText
					id={id}
					name={field.name}
					defaultValue={value ?? ""}
					disabled={disabled}
					required={required}
					aria-required={required || undefined}
					aria-describedby={helpId}
				/>
				{helpText && (
					<p id={helpId} className="text-xs text-text-faint">
						{helpText}
					</p>
				)}
			</div>
		);
	}

	if (inputType === "textarea" || inputType === "json") {
		const isJson = inputType === "json";
		return (
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={id}>
					{label}
					{requiredMark}
				</Label>
				<Textarea
					id={id}
					name={field.name}
					defaultValue={
						isJson && value !== undefined && value !== null
							? JSON.stringify(value, null, 2)
							: (value ?? "")
					}
					disabled={disabled}
					required={required}
					aria-required={required || undefined}
					aria-describedby={helpId}
					rows={isJson ? 6 : 4}
					placeholder={
						isJson ? '{\n  "key": "value"\n}' : (placeholder ?? undefined)
					}
				/>
				{helpText ? (
					<p id={helpId} className="text-xs text-text-faint">
						{helpText}
					</p>
				) : isJson ? (
					<p className="text-xs text-text-faint">Enter valid JSON data.</p>
				) : null}
			</div>
		);
	}

	if (inputType === "datetime-local") {
		return (
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={id}>
					{label}
					{requiredMark}
				</Label>
				<Input
					id={id}
					type="datetime-local"
					name={field.name}
					defaultValue={formatDatetimeLocal(value)}
					disabled={disabled}
					required={required}
					aria-required={required || undefined}
					aria-describedby={helpId}
				/>
				{helpText && (
					<p id={helpId} className="text-xs text-text-faint">
						{helpText}
					</p>
				)}
			</div>
		);
	}

	// text, email, number
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>
				{label}
				{requiredMark}
			</Label>
			<Input
				id={id}
				type={inputType}
				name={field.name}
				defaultValue={value ?? ""}
				disabled={disabled}
				required={required}
				aria-required={required || undefined}
				aria-describedby={helpId}
				placeholder={placeholder}
				autoComplete={inputType === "email" ? "email" : undefined}
			/>
			{helpText && (
				<p id={helpId} className="text-xs text-text-faint">
					{helpText}
				</p>
			)}
		</div>
	);
}
