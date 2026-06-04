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
import {
	cmsArchivePage,
	cmsDeletePage,
	cmsPublishPage,
	cmsUnpublishPage,
	cmsUpdatePage,
} from "../../cms/_actions/content";
import ContentForm from "../../cms/_components/ContentForm";

export async function generateMetadata({ params }) {
	const { model: slug, _id } = await params;
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
		<div className="space-y-6">
			<div>
				<a
					href={`/admin/${slug}`}
					className="text-sm text-text-faint hover:text-text"
				>
					← {model.name}
				</a>
				<h1 className="text-2xl font-bold mt-1 text-text">Edit {model.name}</h1>
				<p className="mt-2 text-sm text-text-faint">
					Update this record through grouped sections so related fields stay
					together.
				</p>
			</div>
			{model.name === "Page" ? (
				<ContentForm
					record={record}
					updateAction={cmsUpdatePage.bind(null, id)}
					publishAction={cmsPublishPage.bind(null, id)}
					archiveAction={cmsArchivePage.bind(null, id)}
					unpublishAction={cmsUnpublishPage.bind(null, id)}
					deleteAction={cmsDeletePage.bind(null, id)}
					modelLabel="Page"
				/>
			) : (
				<ModelForm
					model={model}
					record={record}
					slug={slug}
					readOnly={!!overrides.readOnly}
				/>
			)}
		</div>
	);
}
