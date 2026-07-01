import { hasIdField, isListVisible } from "@techstream/quark-admin";
import {
	Badge,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@techstream/quark-ui";
import Link from "next/link";
import { formatEnumLabel } from "../_lib/display";

/** Map JobStatus-style enum values to Badge variants */
const STATUS_VARIANTS = {
	COMPLETED: "success",
	ACTIVE: "success",
	IN_PROGRESS: "info",
	PENDING: "warning",
	FAILED: "danger",
	CANCELLED: "default",
};

/**
 * Convert camelCase / snake_case field names to human-readable column headers.
 * e.g. "firstName" → "First Name", "createdAt" → "Created At"
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

/**
 * Determine column width class based on field characteristics.
 * @param {{ name: string, type: string, isId: boolean }} field
 * @returns {string}
 */
function getColumnWidth(field) {
	if (field.isId) return "w-[180px] max-w-[180px]";
	if (field.name === "email") return "w-[220px] max-w-[220px]";
	if (field.type === "Boolean") return "w-[80px] max-w-[80px]";
	if (field.type === "DateTime") return "w-[180px] max-w-[180px]";
	if (
		field.type === "Int" ||
		field.type === "Float" ||
		field.type === "Decimal"
	)
		return "w-[100px] max-w-[100px]";
	if (field.kind === "enum") return "w-[140px] max-w-[140px]";
	return "min-w-[120px] max-w-[300px]";
}

/**
 * Format a single cell value for display.
 * @param {unknown} value
 * @param {{ kind?: string, type?: string }} field
 * @returns {import("react").ReactNode}
 */
function formatValue(value, field) {
	if (value === null || value === undefined) return "—";

	if (typeof value === "boolean") {
		return (
			<Badge variant={value ? "success" : "default"}>
				{value ? "Yes" : "No"}
			</Badge>
		);
	}

	if (field.kind === "enum" && typeof value === "string") {
		const variant = STATUS_VARIANTS[value] ?? "default";
		return <Badge variant={variant}>{formatEnumLabel(value)}</Badge>;
	}

	if (value instanceof Date) return value.toLocaleString();
	if (typeof value === "string" && value.length > 60)
		return `${value.slice(0, 60)}…`;
	if (typeof value === "object") return JSON.stringify(value).slice(0, 60);
	return String(value);
}

/**
 * @param {{ model: object, records: object[], slug: string, readOnly: boolean }} props
 */
export default function ModelTable({ model, records, slug, readOnly }) {
	const visibleFields = model.fields.filter(isListVisible);
	const canEdit = !readOnly && hasIdField(model);

	return (
		<Table>
			<TableHeader>
				<TableRow>
					{visibleFields.map((field) => (
						<TableHead
							key={field.name}
							className={`${getColumnWidth(field)} truncate`}
						>
							{humanize(field.name)}
						</TableHead>
					))}
					{canEdit && (
						<TableHead className="text-right w-17.5">Actions</TableHead>
					)}
				</TableRow>
			</TableHeader>
			<TableBody>
				{records.length === 0 ? (
					<TableRow>
						<TableCell
							colSpan={visibleFields.length + (canEdit ? 1 : 0)}
							className="py-12 text-center"
						>
							<div className="flex flex-col items-center gap-2">
								<svg
									aria-hidden="true"
									className="h-8 w-8 text-text-faint"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth="1.5"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
									/>
								</svg>
								<p className="text-sm font-medium text-text-faint">
									No records found
								</p>
								{canEdit && (
									<p className="text-xs text-text-faint">
										Create your first record to get started.
									</p>
								)}
							</div>
						</TableCell>
					</TableRow>
				) : (
					records.map((record) => (
						<TableRow key={record.id ?? JSON.stringify(record)}>
							{visibleFields.map((field) => (
								<TableCell
									key={field.name}
									className={`${getColumnWidth(field)} truncate ${
										field.isId ? "font-mono text-xs text-text-muted" : ""
									}`}
								>
									{formatValue(record[field.name], field)}
								</TableCell>
							))}
							{canEdit && (
								<TableCell className="text-right">
									<Link
										href={`/admin/${slug}/${record.id}`}
										className="inline-flex items-center gap-1 rounded-[--radius-default] px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20 hover:bg-primary/5 transition-colors"
									>
										Edit
									</Link>
								</TableCell>
							)}
						</TableRow>
					))
				)}
			</TableBody>
		</Table>
	);
}
