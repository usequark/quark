import {
	adminConfig,
	findMany,
	getModelBySlug,
	hasIdField,
	isSearchable,
} from "@techstream/quark-admin";
import { prisma } from "@techstream/quark-db";
import { Button, Input } from "@techstream/quark-ui";
import { notFound } from "next/navigation";
import ModelTable from "../_components/ModelTable";

export async function generateMetadata({ params }) {
	const { model: slug } = await params;
	const model = getModelBySlug(slug);
	return { title: model ? model.name : "Model" };
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

	// Build text search filter across all searchable String fields
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

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-text">{model.name}</h1>
					<p className="text-sm text-text-faint mt-1">
						{total} record{total !== 1 ? "s" : ""}
						{search ? ` matching "${search}"` : ""}
					</p>
				</div>
				{canCreate && (
					<a href={`/admin/${slug}/new`}>
						<Button>
							<svg
								aria-hidden="true"
								className="mr-1.5 h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2.5"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M12 4v16m8-8H4"
								/>
							</svg>
							Create {model.name}
						</Button>
					</a>
				)}
			</div>

			{searchableFields.length > 0 && (
				<form
					action={`/admin/${slug}`}
					method="GET"
					className="mb-4 flex gap-2"
				>
					<Input
						type="search"
						name="q"
						defaultValue={search}
						placeholder={`Search ${model.name.toLowerCase()}…`}
						className="max-w-xs"
					/>
					<Button type="submit" variant="secondary">
						Search
					</Button>
					{search && (
						<a href={`/admin/${slug}`}>
							<Button type="button" variant="ghost">
								Clear
							</Button>
						</a>
					)}
				</form>
			)}

			<ModelTable
				model={model}
				records={records}
				slug={slug}
				readOnly={!!overrides.readOnly}
			/>

			{totalPages > 1 && (
				<div className="flex items-center gap-3 mt-4 text-sm text-text-muted">
					{currentPage > 1 && (
						<a
							href={`/admin/${slug}?page=${currentPage - 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
							className="flex items-center gap-1 hover:text-text"
						>
							<svg
								aria-hidden="true"
								className="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15 19l-7-7 7-7"
								/>
							</svg>
							Previous
						</a>
					)}
					<span>
						Page {currentPage} of {totalPages}
					</span>
					{currentPage < totalPages && (
						<a
							href={`/admin/${slug}?page=${currentPage + 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
							className="flex items-center gap-1 hover:text-text"
						>
							Next
							<svg
								aria-hidden="true"
								className="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</a>
					)}
				</div>
			)}
		</div>
	);
}
