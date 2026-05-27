"use client";

import {
	Button,
	Checkbox,
	Dialog,
	Input,
	Label,
	Textarea,
} from "@techstream/quark-ui";
import { useActionState, useState, useTransition } from "react";
import ContentPreview from "./ContentPreview";
import CoverImageField from "./CoverImageField";
import PageBuilder from "./PageBuilder";
import SlugField from "./SlugField";
import StatusBadge from "./StatusBadge";

const initialState = { error: null };

/**
 * Generic create/edit form for CMS content (Page, Post).
 *
 * @param {{
 *   record?: object,
 *   createAction: (prevState: object, formData: FormData) => Promise<object>,
 *   updateAction?: (prevState: object, formData: FormData) => Promise<object>,
 *   deleteAction?: () => Promise<void>,
 *   publishAction?: () => Promise<void>,
 *   archiveAction?: () => Promise<void>,
 *   unpublishAction?: () => Promise<void>,
 *   hasExcerpt?: boolean,
 *   hasCoverImage?: boolean,
 *   modelLabel?: string
 * }} props
 */
export default function ContentForm({
	record,
	createAction,
	updateAction,
	deleteAction,
	publishAction,
	archiveAction,
	unpublishAction,
	hasExcerpt = true,
	hasCoverImage = false,
	modelLabel = "Content",
}) {
	const isEdit = !!record;
	const action = isEdit ? updateAction : createAction;
	const formId = `cms-content-form-${modelLabel.toLowerCase().replace(/\s+/g, "-")}-${isEdit ? "edit" : "new"}`;

	const [state, formAction, isPending] = useActionState(
		async (_prev, formData) => {
			try {
				await action(_prev, formData);
				return { error: null };
			} catch (err) {
				return { error: err?.message ?? "An error occurred" };
			}
		},
		initialState,
	);

	const [title, setTitle] = useState(record?.title ?? "");
	const [excerpt, setExcerpt] = useState(record?.excerpt ?? "");
	const [showHeader, setShowHeader] = useState(record?.showHeader ?? false);
	const [body, setBody] = useState(record?.body ?? "");
	const [pageContent, setPageContent] = useState(record?.content ?? null);
	const [pageLayout, setPageLayout] = useState(record?.layout ?? "standard");
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, startDeleteTransition] = useTransition();

	const status = record?.status ?? "DRAFT";
	const canPublish = status === "DRAFT";
	const canArchive = status === "PUBLISHED";
	const canUnpublish = status === "PUBLISHED";
	const titlePlaceholder =
		modelLabel === "Page"
			? "About, Pricing, Contact, Terms of Service"
			: `${modelLabel} title`;
	const _excerptPlaceholder =
		modelLabel === "Page"
			? "Summarize what this page covers and who it is for."
			: "Short summary (optional)";
	const _bodyPlaceholder =
		modelLabel === "Page"
			? "<h1>Headline</h1>\n<p>Lead paragraph that explains the page.</p>\n\n<h2>Key section</h2>\n<p>Add supporting details, proof, or a clear next step.</p>"
			: "Write your content here…";
	const _bodyHelpText =
		modelLabel === "Page"
			? "A strong page usually has a clear headline, a short intro, 2-3 supporting sections, and a next step. Plain text or basic HTML both work."
			: "Supports plain text or basic HTML.";
	const isPageModel = modelLabel === "Page";
	const previewHref =
		isPageModel && isEdit ? `/admin/cms/pages/${record.id}/preview` : null;
	const livePageHref =
		isPageModel && record?.status === "PUBLISHED" && record?.slug
			? `/${record.slug}`
			: null;

	function openInNewTab(href) {
		if (!href) return;
		window.open(href, "_blank", "noopener,noreferrer");
	}

	return (
		<div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(38rem,44rem)] lg:items-start">
			<div className="min-w-0">
				<form id={formId} action={formAction} className="space-y-5">
					{!isEdit && modelLabel === "Page" && (
						<div className="rounded-[--radius-default] border border-border bg-surface px-4 py-3">
							<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
								Starter Checklist
							</p>
							<p className="mt-2 text-sm text-text-muted">
								Give the page a descriptive title, keep the excerpt to one or
								two sentences, and use the body for the full structure.
							</p>
						</div>
					)}

					{/* Page Identity */}
					<section className="rounded-[--radius-default] border border-border bg-surface p-4 shadow-sm sm:p-5">
						<PanelHeader
							title="Page Details"
							description="The title and slug identify this page publicly."
						/>
						<div className="space-y-4">
							<div className="flex flex-col gap-1">
								<Label htmlFor="cms-title">Title *</Label>
								<Input
									id="cms-title"
									type="text"
									name="title"
									defaultValue={record?.title ?? ""}
									required
									placeholder={titlePlaceholder}
									onChange={(e) => setTitle(e.target.value)}
								/>
							</div>

							<SlugField
								title={title}
								defaultSlug={record?.slug ?? ""}
								required
							/>

							{hasExcerpt && (
								<div className="flex flex-col gap-1">
									<Label htmlFor="cms-excerpt">Excerpt</Label>
									<Textarea
										id="cms-excerpt"
										name="excerpt"
										value={excerpt}
										rows={2}
										placeholder="Short summary (optional)"
										onChange={(e) => setExcerpt(e.target.value)}
									/>
								</div>
							)}

							{isPageModel && (
								<div className="border-t border-border pt-4">
									<input
										type="hidden"
										name="showHeader"
										value={showHeader ? "on" : ""}
									/>
									<Checkbox
										id="cms-show-header"
										label="Show title and excerpt above sections"
										checked={showHeader}
										onChange={(e) => setShowHeader(e.target.checked)}
									/>
									<p className="mt-1.5 pl-6 text-xs text-text-faint">
										By default the title and excerpt are hidden on the live page
										— use a Hero section instead.
									</p>
								</div>
							)}
						</div>
					</section>

					{hasCoverImage && (
						<section className="rounded-[--radius-default] border border-border bg-surface p-4 shadow-sm sm:p-5">
							<PanelHeader
								title="Media"
								description="Select or upload a cover image for this page."
							/>
							<CoverImageField defaultValue={record?.coverImage ?? ""} />
						</section>
					)}

					{isPageModel ? (
						<div className="space-y-3">
							<PageBuilder
								defaultContent={record?.content}
								defaultBody={record?.body ?? ""}
								defaultLayout={record?.layout ?? "standard"}
								onContentChange={setPageContent}
								onLayoutChange={setPageLayout}
							/>
							<p className="px-1 text-xs text-text-faint">
								Use sections to shape the public page instead of writing one
								long body field.
							</p>
						</div>
					) : (
						<section className="rounded-[--radius-default] border border-border bg-surface p-4 shadow-sm sm:p-5">
							<PanelHeader
								title="Body"
								description="Write and structure the full content body."
							/>
							<div className="flex flex-col gap-1">
								<Label htmlFor="cms-body">Body *</Label>
								<Textarea
									id="cms-body"
									name="body"
									value={body}
									required
									rows={16}
									placeholder="Write your content here…"
									className="font-mono text-sm leading-relaxed resize-y"
									onChange={(e) => setBody(e.target.value)}
								/>
								<p className="text-xs text-text-faint">
									Supports plain text or basic HTML.
								</p>
							</div>
						</section>
					)}

					{state?.error && (
						<p className="rounded-[--radius-default] border border-danger/40 bg-danger-muted px-4 py-3 text-sm text-danger">
							{state.error}
						</p>
					)}
				</form>
			</div>

			<aside className="space-y-4 lg:sticky lg:-top-2 lg:self-start">
				<ContentPreview
					title={isPageModel ? title : undefined}
					excerpt={isPageModel ? excerpt : undefined}
					layout={isPageModel ? pageLayout : undefined}
					content={isPageModel ? pageContent : undefined}
					body={body}
				/>

				<div className="rounded-[--radius-default] border border-border bg-surface p-4 space-y-3">
					<PanelHeader
						title="Status"
						description="Set the publishing state for this entry."
						rightSlot={isEdit ? <StatusBadge status={status} /> : null}
					/>

					{isEdit && (
						<div className="flex flex-col gap-2">
							{canPublish && publishAction && (
								<form action={publishAction}>
									<Button type="submit" className="w-full" variant="primary">
										Publish
									</Button>
								</form>
							)}
							{canUnpublish && unpublishAction && (
								<form action={unpublishAction}>
									<Button type="submit" className="w-full" variant="secondary">
										Revert to Draft
									</Button>
								</form>
							)}
							{canArchive && archiveAction && (
								<form action={archiveAction}>
									<Button type="submit" className="w-full" variant="warning">
										Archive
									</Button>
								</form>
							)}
						</div>
					)}

					{!isEdit && (
						<p className="text-xs text-text-faint">
							Saved as <strong>Draft</strong> — publish after creating.
						</p>
					)}

					{isPageModel && (
						<div className="space-y-2 border-t border-border pt-3">
							<Button
								type="button"
								variant="secondary"
								className="w-full"
								disabled={!previewHref}
								onClick={() => openInNewTab(previewHref)}
							>
								PREVIEW
							</Button>

							{livePageHref ? (
								<Button
									type="button"
									variant="secondary"
									className="w-full"
									onClick={() => openInNewTab(livePageHref)}
								>
									VIEW LIVE PAGE
								</Button>
							) : null}

							<p className="text-xs leading-5 text-text-faint">
								{previewHref
									? "Preview opens the most recently saved version in a protected admin view."
									: "Save this page once to open a protected preview in a new tab."}
							</p>
						</div>
					)}
				</div>

				{isEdit && (
					<div className="rounded-[--radius-default] border border-border bg-surface p-4 space-y-2">
						<PanelHeader
							title="Timestamps"
							description="Review key lifecycle dates for this entry."
						/>
						<div className="space-y-1">
							<MetaRow label="Created" value={formatDate(record.createdAt)} />
							<MetaRow label="Updated" value={formatDate(record.updatedAt)} />
							{record.publishedAt && (
								<MetaRow
									label="Published"
									value={formatDate(record.publishedAt)}
								/>
							)}
						</div>
					</div>
				)}

				<div className="rounded-[--radius-default] border border-border bg-surface p-4 shadow-sm sm:p-5">
					<PanelHeader
						title="Actions"
						description={`Save changes or cancel this ${modelLabel.toLowerCase()} edit.`}
					/>
					<div className="flex flex-col gap-3">
						<Button
							type="submit"
							form={formId}
							disabled={isPending}
							className="w-full justify-center"
						>
							{isPending
								? "Saving…"
								: isEdit
									? "Save changes"
									: `Create ${modelLabel}`}
						</Button>
						<Button
							type="button"
							variant="danger"
							className="w-full justify-center"
							onClick={() => {
								window.location.href = "./";
							}}
						>
							Cancel
						</Button>
					</div>
				</div>

				{isEdit && deleteAction && (
					<div className="rounded-[--radius-default] border border-danger/30 bg-surface p-4 space-y-3">
						<PanelHeader
							title="Danger Zone"
							description={`Permanently remove this ${modelLabel.toLowerCase()}.`}
						/>
						<Button
							type="button"
							variant="danger"
							className="w-full"
							onClick={() => setDeleteOpen(true)}
						>
							Delete {modelLabel}
						</Button>
					</div>
				)}
			</aside>

			{isEdit && deleteAction && (
				<Dialog
					open={deleteOpen}
					onClose={() => setDeleteOpen(false)}
					title={`Delete ${modelLabel}`}
				>
					<div className="space-y-4">
						<p className="text-sm">
							Are you sure you want to delete this {modelLabel.toLowerCase()}?
							This cannot be undone.
						</p>
						<div className="flex gap-2 justify-end pt-4 border-t border-border -mx-5 px-5">
							<Button
								variant="secondary"
								onClick={() => setDeleteOpen(false)}
								disabled={isDeleting}
							>
								Keep it
							</Button>
							<Button
								variant="danger"
								disabled={isDeleting}
								onClick={() => {
									startDeleteTransition(async () => {
										await deleteAction();
									});
								}}
							>
								{isDeleting ? "Deleting\u2026" : `Delete ${modelLabel}`}
							</Button>
						</div>
					</div>
				</Dialog>
			)}
		</div>
	);
}

function PanelHeader({ title, description, rightSlot = null }) {
	return (
		<div className="mb-4 border-b border-border pb-3">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
					{title}
				</h2>
				{rightSlot}
			</div>
			<p className="mt-1 text-sm text-text-faint">{description}</p>
		</div>
	);
}

function MetaRow({ label, value }) {
	return (
		<div className="flex items-center justify-between gap-2">
			<span className="text-xs text-text-faint">{label}</span>
			<span className="text-xs text-text-muted tabular-nums">{value}</span>
		</div>
	);
}

function formatDate(date) {
	if (!date) return "—";
	return new Date(date).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
