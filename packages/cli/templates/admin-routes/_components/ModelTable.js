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
		return <Badge variant={variant}>{value}</Badge>;
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
							{field.name}
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
							className="text-center text-text-faint py-10"
						>
							No records found
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
									<a
										href={`/admin/${slug}/${record.id}`}
										className="text-sm text-primary hover:opacity-75"
									>
										Edit
									</a>
								</TableCell>
							)}
						</TableRow>
					))
				)}
			</TableBody>
		</Table>
	);
}
