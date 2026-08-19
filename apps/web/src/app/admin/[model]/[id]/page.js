import {
	adminConfig,
	coerceId,
	findById,
	getModelBySlug,
	hasIdField,
} from "@techstream/quark-admin";
import { prisma } from "@techstream/quark-db";
import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm from "../../_patterns/ActionForm";

export async function generateMetadata({ params }) {
	const { model: slug } = await params;
	const model = getModelBySlug(slug);
	return { title: model ? `Edit ${model.name}` : "Edit Record" };
}

export default async function EditRecordPage({ params }) {
	const { model: slug, id } = await params;

	const model = getModelBySlug(slug);
	if (!model || !hasIdField(model)) notFound();

	const overrides = adminConfig.modelOverrides[model.name] ?? {};

	const record = await findById(prisma, model.name, coerceId(model, id));
	if (!record) notFound();

	return (
		<div className="max-w-3xl space-y-6">
			<div>
				<Link
					href={`/admin/${slug}`}
					className="text-sm font-medium text-gray-500 hover:text-gray-900"
				>
					&larr; {model.name}
				</Link>
				<h1 className="mt-1 text-2xl font-bold text-gray-900">
					Edit {model.name}
				</h1>
			</div>
			<ActionForm
				model={model}
				record={record}
				slug={slug}
				readOnly={!!overrides.readOnly}
			/>
		</div>
	);
}
