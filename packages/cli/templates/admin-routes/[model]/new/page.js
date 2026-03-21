import {
	adminConfig,
	getModelBySlug,
	hasIdField,
} from "@techstream/quark-admin";
import { notFound } from "next/navigation";
import ModelForm from "../../_components/ModelForm";

export default async function NewRecordPage({ params }) {
	const { model: slug } = await params;

	const model = getModelBySlug(slug);
	if (!model || !hasIdField(model)) notFound();

	const overrides = adminConfig.modelOverrides[model.name] ?? {};
	if (overrides.readOnly) notFound();

	return (
		<div>
			<div className="mb-6">
				<a
					href={`/admin/${slug}`}
					className="text-sm text-gray-500 dark:text-[#4a4a6a] hover:text-gray-700 dark:hover:text-[#e0e0e0]"
				>
					← {model.name}
				</a>
				<h1 className="text-2xl font-bold mt-1 dark:text-[#e0e0e0]">
					Create {model.name}
				</h1>
			</div>
			<ModelForm model={model} slug={slug} />
		</div>
	);
}
