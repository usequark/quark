import {
	adminConfig,
	getModelBySlug,
	hasIdField,
} from "@techstream/quark-admin";
import { notFound } from "next/navigation";
import ModelForm from "../../_components/ModelForm";

export async function generateMetadata({ params }) {
	const { model: slug } = await params;
	const model = getModelBySlug(slug);
	return { title: model ? `New ${model.name}` : "New Record" };
}

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
					className="text-sm text-text-faint hover:text-text"
				>
					← {model.name}
				</a>
				<h1 className="text-2xl font-bold mt-1 text-text">
					Create {model.name}
				</h1>
			</div>
			<ModelForm model={model} slug={slug} />
		</div>
	);
}
