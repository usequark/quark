import {
	adminConfig,
	findMany,
	getModelBySlug,
	hasIdField,
	isListVisible,
	isSearchable,
} from "@techstream/quark-admin";
import { prisma } from "@techstream/quark-db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatEnumLabel } from "../_lib/display";

export async function generateMetadata({ params }) {
	const { model: slug } = await params;
	const model = getModelBySlug(slug);
	return { title: model ? model.name : "Model" };
}

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

function formatValue(value, field) {
	if (value === null || value === undefined) return "-";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (field.kind === "enum" && typeof value === "string")
		return formatEnumLabel(value);
	if (value instanceof Date) return value.toLocaleString();
	if (typeof value === "string" && value.length > 60)
		return `${value.slice(0, 60)}…`;
	if (typeof value === "object") return JSON.stringify(value).slice(0, 60);
	return String(value);
}

export default async function ModelListPage({ params, searchParams }) {
	const { model: slug } = await params;
	const { page, q } = await searchParams;

	const model = getModelBySlug(slug);
	if (!model) notFound();

	const overrides = adminConfig.modelOverrides[model.name] ?? {};
	const pageSize = adminConfig.pageSize;
	const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
	const search = typeof q === "string" ? q.trim() : "";

	const searchableFields = model.fields.filter(isSearchable);
	const where =
		search && searchableFields.length > 0
			? {
					OR: searchableFields.map((f) =>
						f.kind === "enum"
							? { [f.name]: { equals: search } }
							: { [f.name]: { contains: search, mode: "insensitive" } },
					),
				}
			: undefined;

	const { records, total } = await findMany(prisma, model.name, {
		skip: (currentPage - 1) * pageSize,
		take: pageSize,
		where,
	});

	const totalPages = Math.ceil(total / pageSize);
	const canCreate = !overrides.readOnly && hasIdField(model);
	const visibleFields = model.fields.filter((field) =>
		isListVisible(field, model.name),
	);

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">{model.name}</h1>
					<p className="mt-1 text-sm text-gray-500">
						{total} record{total !== 1 ? "s" : ""}
						{search ? ` matching "${search}"` : ""}
					</p>
				</div>
				{canCreate && (
					<Link
						href={`/admin/${slug}/new`}
						className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
					>
						Create {model.name}
					</Link>
				)}
			</div>

			{searchableFields.length > 0 && (
				<form
					action={`/admin/${slug}`}
					method="GET"
					className="mb-4 flex gap-2"
				>
					<input
						type="search"
						name="q"
						defaultValue={search}
						placeholder={`Search ${model.name.toLowerCase()}…`}
						className="max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
					/>
					<button
						type="submit"
						className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Search
					</button>
					{search && (
						<Link
							href={`/admin/${slug}`}
							className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
						>
							Clear
						</Link>
					)}
				</form>
			)}

			<div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
				<table className="min-w-full divide-y divide-gray-200">
					<thead className="bg-gray-50">
						<tr>
							{visibleFields.map((field) => (
								<th
									key={field.name}
									scope="col"
									className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-500"
								>
									{humanize(field.name)}
								</th>
							))}
							{canCreate && (
								<th
									scope="col"
									className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-500"
								>
									Actions
								</th>
							)}
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200">
						{records.length === 0 ? (
							<tr>
								<td
									colSpan={visibleFields.length + (canCreate ? 1 : 0)}
									className="px-4 py-12 text-center text-sm text-gray-500"
								>
									No records found
								</td>
							</tr>
						) : (
							records.map((record) => (
								<tr key={record.id ?? JSON.stringify(record)}>
									{visibleFields.map((field) => (
										<td
											key={field.name}
											className={`px-4 py-3 text-sm text-gray-700 ${
												field.isId ? "font-mono text-xs text-gray-500" : ""
											}`}
										>
											{formatValue(record[field.name], field)}
										</td>
									))}
									{canCreate && (
										<td className="px-4 py-3 text-right">
											<Link
												href={`/admin/${slug}/${record.id}`}
												className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
											>
												Edit
											</Link>
										</td>
									)}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
					{currentPage > 1 && (
						<Link
							href={`/admin/${slug}?page=${currentPage - 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
							className="hover:text-gray-900"
						>
							Previous
						</Link>
					)}
					<span>
						Page {currentPage} of {totalPages}
					</span>
					{currentPage < totalPages && (
						<Link
							href={`/admin/${slug}?page=${currentPage + 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
							className="hover:text-gray-900"
						>
							Next
						</Link>
					)}
				</div>
			)}
		</div>
	);
}
