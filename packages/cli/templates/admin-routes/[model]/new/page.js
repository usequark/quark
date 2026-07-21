import {
	adminConfig,
	getModelBySlug,
	hasIdField,
} from "@techstream/quark-admin";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import ModelForm from "../../_components/ModelForm";
import { cmsCreatePage } from "../../cms/_actions/content";
import ContentForm from "../../cms/_components/ContentForm";

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
		<div className="max-w-6xl mx-auto space-y-6">
			<div>
				<a
					href={`/admin/${slug}`}
					className="inline-flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text bg-surface border border-border hover:border-border-hover px-3 py-1.5 rounded-[--radius-default] transition-colors mb-2"
				>
					<ChevronLeft size={15} />
					{model.name}
				</a>
				<h1 className="text-2xl font-bold mt-1 text-text">
					Create {model.name}
				</h1>
				<p className="mt-2 text-sm text-text-faint">
					Add a new record using focused sections for details, content, and
					settings.
				</p>
			</div>
			{model.name === "Page" ? (
				<ContentForm createAction={cmsCreatePage} modelLabel="Page" />
			) : (
				<ModelForm model={model} slug={slug} />
			)}
		</div>
	);
}
