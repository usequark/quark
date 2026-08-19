import { adminConfig, getModelBySlug, hasIdField } from "@techstream/quark-admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm from "../../_patterns/ActionForm";

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
		<div className="max-w-3xl space-y-6">
			<div>
				<Link
					href={`/admin/${slug}`}
					className="text-sm font-medium text-gray-500 hover:text-gray-900"
				>
					&larr; {model.name}
				</Link>
				<h1 className="mt-1 text-2xl font-bold text-gray-900">
					Create {model.name}
				</h1>
			</div>
			<ActionForm model={model} slug={slug} />
		</div>
	);
}
