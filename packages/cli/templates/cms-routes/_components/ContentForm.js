"use client";

import { Button, Dialog, Input, Label, Textarea } from "@techstream/quark-ui";
import { useActionState, useState, useTransition } from "react";
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
	const excerptPlaceholder =
		modelLabel === "Page"
			? "Summarize what this page covers and who it is for."
			: "Short summary (optional)";
	const bodyPlaceholder =
		modelLabel === "Page"
			? "<h1>Headline</h1>\n<p>Lead paragraph that explains the page.</p>\n\n<h2>Key section</h2>\n<p>Add supporting details, proof, or a clear next step.</p>"
			: "Write your content here…";
	const bodyHelpText =
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
		<div className="flex flex-col gap-6 lg:flex-row lg:items-start">
			{/* Main editor — takes 2/3 width on large screens */}
			<div className="flex-1 min-w-0">
				<form action={formAction} className="space-y-5">
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

					{/* Title */}
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

					{/* Slug — auto-generated from title */}
					<SlugField title={title} defaultSlug={record?.slug ?? ""} required />

					{/* Excerpt */}
					{hasExcerpt && (
						<div className="flex flex-col gap-1">
							<Label htmlFor="cms-excerpt">Excerpt</Label>
							<Textarea
								id="cms-excerpt"
								name="excerpt"
								defaultValue={record?.excerpt ?? ""}
								rows={2}
								placeholder={excerptPlaceholder}
							/>
						</div>
					)}

					{/* Cover image picker */}
					{hasCoverImage && (
						<CoverImageField defaultValue={record?.coverImage ?? ""} />
					)}

					{/* Body / sections */}
					{isPageModel ? (
						<div className="space-y-3">
							<div>
								<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
									Page Builder
								</p>
								<p className="mt-1 text-sm text-text-muted">
									Build the page with sections for rich text, media, and calls
									to action.
								</p>
							</div>
							<PageBuilder
								defaultContent={record?.content}
								defaultBody={record?.body ?? ""}
								defaultLayout={record?.layout ?? "standard"}
							/>
							<p className="text-xs text-text-faint">
								Use sections to shape the public page instead of writing one
								long body field.
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-1">
							<Label htmlFor="cms-body">Body *</Label>
							<Textarea
								id="cms-body"
								name="body"
								defaultValue={record?.body ?? ""}
								required
								rows={16}
								placeholder={bodyPlaceholder}
								className="font-mono text-sm leading-relaxed resize-y"
							/>
							<p className="text-xs text-text-faint">{bodyHelpText}</p>
						</div>
					)}

					<div className="flex items-center gap-3 pt-4 border-t border-border">
						<Button type="submit" disabled={isPending}>
							{isPending
								? "Saving…"
								: isEdit
									? "Save changes"
									: `Create ${modelLabel}`}
						</Button>
						<a
							href="./"
							className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium tracking-wide rounded-[--radius-default] text-text-faint hover:bg-surface-hover hover:text-text transition-all duration-200 linear"
						>
							Cancel
						</a>
					</div>

					{state?.error && <p className="text-sm text-danger">{state.error}</p>}
				</form>
			</div>

			{/* Sidebar metadata panel */}
			<aside className="lg:w-64 shrink-0 space-y-4">
				{/* Status */}
				<div className="rounded-[--radius-default] border border-border bg-surface p-4 space-y-3">
					<div className="flex items-center justify-between">
						<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
							Status
						</p>
						{isEdit && <StatusBadge status={status} />}
					</div>

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
									<Button type="submit" className="w-full" variant="secondary">
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

				{/* Timestamps (edit only) */}
				{isEdit && (
					<div className="rounded-[--radius-default] border border-border bg-surface p-4 space-y-2">
						<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
							Timestamps
						</p>
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

				{/* Danger zone */}
				{isEdit && deleteAction && (
					<div className="rounded-[--radius-default] border border-danger/30 bg-surface p-4 space-y-3">
						<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
							Danger Zone
						</p>
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
