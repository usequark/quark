import {
	adminConfig,
	coerceId,
	findById,
	getModelBySlug,
	hasIdField,
} from "@techstream/quark-admin";
import { prisma } from "@techstream/quark-db";
import { notFound } from "next/navigation";
import ModelForm from "../../_components/ModelForm";

export default async function EditRecordPage({ params }) {
	const { model: slug, id } = await params;

	const model = getModelBySlug(slug);
	if (!model || !hasIdField(model)) notFound();

	const overrides = adminConfig.modelOverrides[model.name] ?? {};

	const record = await findById(prisma, model.name, coerceId(model, id));
	if (!record) notFound();

	return (
		<div>
			<div className="mb-6">
				<a
					href={`/admin/${slug}`}
					className="text-sm text-gray-500 hover:text-gray-700"
				>
					← {model.name}
				</a>
				<h1 className="text-2xl font-bold mt-1">Edit {model.name}</h1>
			</div>
			<ModelForm
				model={model}
				record={record}
				slug={slug}
				readOnly={!!overrides.readOnly}
			/>
		</div>
	);
}
