import {
	adminConfig,
	findMany,
	getModelBySlug,
	hasIdField,
} from "@techstream/quark-admin";
import { prisma } from "@techstream/quark-db";
import { Button } from "@techstream/quark-ui";
import { notFound } from "next/navigation";
import ModelTable from "../_components/ModelTable";

export default async function ModelListPage({ params, searchParams }) {
	const { model: slug } = await params;
	const { page } = await searchParams;

	const model = getModelBySlug(slug);
	if (!model) notFound();

	const overrides = adminConfig.modelOverrides[model.name] ?? {};
	const pageSize = adminConfig.pageSize;
	const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

	const { records, total } = await findMany(prisma, model.name, {
		skip: (currentPage - 1) * pageSize,
		take: pageSize,
	});

	const totalPages = Math.ceil(total / pageSize);
	const canCreate = !overrides.readOnly && hasIdField(model);

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold">{model.name}</h1>
					<p className="text-sm text-gray-500 mt-1">
						{total} record{total !== 1 ? "s" : ""}
					</p>
				</div>
				{canCreate && (
					<a href={`/admin/${slug}/new`}>
						<Button>Create {model.name}</Button>
					</a>
				)}
			</div>

			<ModelTable
				model={model}
				records={records}
				slug={slug}
				readOnly={!!overrides.readOnly}
			/>

			{totalPages > 1 && (
				<div className="flex items-center gap-3 mt-4 text-sm text-gray-600">
					{currentPage > 1 && (
						<a
							href={`/admin/${slug}?page=${currentPage - 1}`}
							className="hover:text-gray-900"
						>
							← Previous
						</a>
					)}
					<span>
						Page {currentPage} of {totalPages}
					</span>
					{currentPage < totalPages && (
						<a
							href={`/admin/${slug}?page=${currentPage + 1}`}
							className="hover:text-gray-900"
						>
							Next →
						</a>
					)}
				</div>
			)}
		</div>
	);
}
