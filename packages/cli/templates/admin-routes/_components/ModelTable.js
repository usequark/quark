import { hasIdField, isListVisible } from "@techstream/quark-admin";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@techstream/quark-ui";

/**
 * Format a single cell value for display.
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value) {
	if (value === null || value === undefined) return "—";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (value instanceof Date) return value.toLocaleString();
	if (typeof value === "string" && value.length > 80)
		return `${value.slice(0, 80)}…`;
	if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
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
						<TableHead key={field.name}>{field.name}</TableHead>
					))}
					{canEdit && (
						<TableHead className="text-right w-20">Actions</TableHead>
					)}
				</TableRow>
			</TableHeader>
			<TableBody>
				{records.length === 0 ? (
					<TableRow>
						<TableCell
							colSpan={visibleFields.length + (canEdit ? 1 : 0)}
							className="text-center text-gray-400 dark:text-[#4a4a6a] py-10"
						>
							No records found
						</TableCell>
					</TableRow>
				) : (
					records.map((record) => (
						<TableRow key={record.id ?? JSON.stringify(record)}>
							{visibleFields.map((field) => (
								<TableCell key={field.name}>
									{formatValue(record[field.name])}
								</TableCell>
							))}
							{canEdit && (
								<TableCell className="text-right">
									<a
										href={`/admin/${slug}/${record.id}`}
										className="text-sm text-blue-600 dark:text-[#377dff] hover:text-blue-800 dark:hover:text-[#377dff]/80"
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
