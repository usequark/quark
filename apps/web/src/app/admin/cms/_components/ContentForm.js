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
import CoverImageField from "./CoverImageField";
import PageBuilder from "./PageBuilder";
import SlugField from "./SlugField";
import StatusBadge from "./StatusBadge";

const initialState = { error: null };

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
				if (
					typeof err?.digest === "string" &&
					err.digest.startsWith("NEXT_REDIRECT")
				) {
					throw err;
				}
				return { error: err?.message ?? "An error occurred" };
			}
		},
		initialState,
	);

	const [title, setTitle] = useState(record?.title ?? "");
	const [excerpt, setExcerpt] = useState(record?.excerpt ?? "");
	const [showHeader, setShowHeader] = useState(record?.showHeader ?? false);
	const [body, setBody] = useState(record?.body ?? "");
	const [coverImageAlt, setCoverImageAlt] = useState(
		record?.coverImageAlt ?? "",
	);
	const [_pageContent, setPageContent] = useState(record?.content ?? null);
	const [_pageLayout, setPageLayout] = useState(record?.layout ?? "standard");
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, startDeleteTransition] = useTransition();

	const status = record?.status ?? "DRAFT";
	const canPublish = status === "DRAFT";
	const canArchive = status === "PUBLISHED";
	const canUnpublish = status === "PUBLISHED";
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
		<div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(36rem,42rem)] xl:items-start">
			<div className="min-w-0">
				<form id={formId} action={formAction} className="space-y-6">
					{/* Page identity */}
					<section className="border border-border bg-surface">
						<div className="flex items-center gap-2 border-b border-border px-5 py-3">
							<svg
								aria-hidden="true"
								className="h-4 w-4 text-text-faint"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
								/>
							</svg>
							<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
								Page Details
							</h2>
						</div>
						<div className="space-y-5 p-5">
							{!isEdit && modelLabel === "Page" && (
								<div className="border border-primary/20 bg-primary-muted px-4 py-3">
									<p className="text-xs font-semibold text-primary">
										Getting started
									</p>
									<ul className="mt-2 space-y-1">
										<li className="flex items-start gap-2 text-sm text-primary/80">
											<span className="mt-0.5 text-primary">&#x2022;</span>
											<span>
												Give your page a clear title - this becomes the page
												heading and browser tab label.
											</span>
										</li>
										<li className="flex items-start gap-2 text-sm text-primary/80">
											<span className="mt-0.5 text-primary">&#x2022;</span>
											<span>
												Add sections below to build the page content (hero,
												text, images, call-to-action).
											</span>
										</li>
									</ul>
								</div>
							)}

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="cms-title">
									{modelLabel === "Page" ? "Page title" : `${modelLabel} title`}{" "}
									*
								</Label>
								<Input
									id="cms-title"
									type="text"
									name="title"
									defaultValue={record?.title ?? ""}
									required
									placeholder={
										modelLabel === "Page"
											? "e.g. About Us, Pricing, Contact"
											: `e.g. My ${modelLabel}`
									}
									onChange={(e) => setTitle(e.target.value)}
								/>
								<p className="text-xs text-text-faint">
									{modelLabel === "Page"
										? "Appears at the top of the page and in browser tabs. Use clear, descriptive titles."
										: "A short, descriptive title for this entry."}
								</p>
							</div>

							<SlugField
								title={title}
								defaultSlug={record?.slug ?? ""}
								required
							/>

							{hasExcerpt && (
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="cms-excerpt">Excerpt</Label>
									<Textarea
										id="cms-excerpt"
										name="excerpt"
										value={excerpt}
										rows={2}
										placeholder={
											modelLabel === "Page"
												? "A short summary of what this page is about"
												: "Brief summary (optional)"
										}
										onChange={(e) => setExcerpt(e.target.value)}
									/>
									<p className="text-xs text-text-faint">
										{modelLabel === "Page"
											? "Shown in search results and page previews. Keep it to 1-2 sentences."
											: "Optional short description for listings."}
									</p>
								</div>
							)}

							{isPageModel && (
								<div className="border-t border-border pt-5">
									<input
										type="hidden"
										name="showHeader"
										value={showHeader ? "on" : ""}
									/>
									<Checkbox
										id="cms-show-header"
										label="Show the page title and excerpt at the top"
										checked={showHeader}
										onChange={(e) => setShowHeader(e.target.checked)}
									/>
									<p className="mt-1.5 pl-6 text-xs text-text-faint">
										By default the title is hidden - use a Hero section instead
										for a more polished look. Check this if you want a simple
										title bar.
									</p>
								</div>
							)}
						</div>
					</section>

					{hasCoverImage && (
						<section className="border border-border bg-surface">
							<div className="flex items-center gap-2 border-b border-border px-5 py-3">
								<svg
									aria-hidden="true"
									className="h-4 w-4 text-text-faint"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
								<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
									Media
								</h2>
							</div>
							<div className="p-5 space-y-4">
								<CoverImageField
									defaultValue={record?.coverImage ?? ""}
									onAltChange={setCoverImageAlt}
								/>
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="cms-cover-image-alt">Image Alt text</Label>
									<Input
										id="cms-cover-image-alt"
										type="text"
										name="coverImageAlt"
										value={coverImageAlt}
										onChange={(e) => setCoverImageAlt(e.target.value)}
										placeholder="Describe the image for screen readers"
									/>
								</div>
							</div>
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
						</div>
					) : (
						<section className="border border-border bg-surface">
							<div className="flex items-center gap-2 border-b border-border px-5 py-3">
								<svg
									aria-hidden="true"
									className="h-4 w-4 text-text-faint"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
								<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
									Body Content
								</h2>
							</div>
							<div className="p-5 space-y-3">
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="cms-body">Content *</Label>
									<Textarea
										id="cms-body"
										name="body"
										value={body}
										required
										rows={16}
										placeholder="Write your content here. Plain text or basic HTML works."
										className="font-mono text-sm leading-relaxed resize-y"
										onChange={(e) => setBody(e.target.value)}
									/>
									<p className="text-xs text-text-faint">
										Supports plain text or basic HTML.
									</p>
								</div>
							</div>
						</section>
					)}

					{/* Save / Cancel inline - visible on mobile */}
					<div className="flex items-center gap-3 lg:hidden">
						<Button
							type="submit"
							form={formId}
							disabled={isPending}
							className="flex-1 justify-center"
						>
							{isPending
								? "Saving\u2026"
								: isEdit
									? "Save changes"
									: `Create ${modelLabel}`}
						</Button>
						<Button
							type="button"
							variant="secondary"
							className="flex-1 justify-center"
							onClick={() => {
								window.location.href = "./";
							}}
						>
							Cancel
						</Button>
					</div>

					{state?.error && (
						<p className="border border-danger/40 bg-danger-muted px-4 py-3 text-sm text-danger">
							{state.error}
						</p>
					)}
				</form>
			</div>

			<aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
				{/* Publishing */}
				<div className="border border-border bg-surface">
					<div className="flex items-center gap-2 border-b border-border px-4 py-3">
						<svg
							aria-hidden="true"
							className="h-4 w-4 text-text-faint"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
							Status
						</h2>
						<div className="ml-auto">
							{isEdit && <StatusBadge status={status} />}
						</div>
					</div>
					<div className="space-y-3 p-4">
						{isEdit && (
							<div className="flex flex-col gap-2">
								{canPublish && publishAction && (
									<form action={publishAction}>
										<Button type="submit" className="w-full" variant="outline">
											Publish
										</Button>
									</form>
								)}
								{canUnpublish && unpublishAction && (
									<form action={unpublishAction}>
										<Button
											type="submit"
											className="w-full"
											variant="secondary"
										>
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
								Saved as <strong>Draft</strong> - publish after creating.
							</p>
						)}

						{isEdit && (
							<div className="border-t border-border pt-3 space-y-2">
								<div className="flex items-center justify-between gap-2">
									<span className="text-xs text-text-faint">Created</span>
									<span className="text-xs text-text-muted tabular-nums">
										{formatDate(record.createdAt)}
									</span>
								</div>
								<div className="flex items-center justify-between gap-2">
									<span className="text-xs text-text-faint">Updated</span>
									<span className="text-xs text-text-muted tabular-nums">
										{formatDate(record.updatedAt)}
									</span>
								</div>
								{record.publishedAt && (
									<div className="flex items-center justify-between gap-2">
										<span className="text-xs text-text-faint">Published</span>
										<span className="text-xs text-text-muted tabular-nums">
											{formatDate(record.publishedAt)}
										</span>
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Page links */}
				{isPageModel && (
					<div className="border border-border bg-surface p-4 space-y-2">
						<div className="flex items-center gap-2">
							<svg
								aria-hidden="true"
								className="h-4 w-4 text-text-faint"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
								/>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
								/>
							</svg>
							<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
								Preview &amp; View
							</h2>
						</div>
						<Button
							type="button"
							variant="secondary"
							className="w-full"
							disabled={!previewHref}
							onClick={() => openInNewTab(previewHref)}
						>
							Preview page
						</Button>

						{livePageHref ? (
							<Button
								type="button"
								variant="secondary"
								className="w-full"
								onClick={() => openInNewTab(livePageHref)}
							>
								View live page
							</Button>
						) : null}

						<p className="text-xs leading-5 text-text-faint">
							{previewHref
								? "Preview opens the last saved version in a protected admin view."
								: "Save once to enable preview."}
						</p>
					</div>
				)}

				{/* Save / Cancel */}
				<div className="border border-border bg-surface p-4 space-y-3">
					<div className="flex items-center gap-2">
						<svg
							aria-hidden="true"
							className="h-4 w-4 text-text-faint"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
							/>
						</svg>
						<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
							Actions
						</h2>
					</div>
					<div className="flex flex-col gap-2">
						<Button
							type="submit"
							form={formId}
							disabled={isPending}
							variant="outline"
							className="w-full justify-center"
						>
							{isPending
								? "Saving\u2026"
								: isEdit
									? "Save changes"
									: `Create ${modelLabel}`}
						</Button>
						<Button
							type="button"
							variant="secondary"
							className="w-full justify-center border-red-500! text-red-500! hover:bg-red-50!"
							onClick={() => {
								window.location.href = "./";
							}}
						>
							Cancel
						</Button>
					</div>
				</div>

				{/* Delete */}
				{isEdit && deleteAction && (
					<div className="border border-danger/20 bg-surface p-4 space-y-3">
						<div className="flex items-center gap-2">
							<svg
								aria-hidden="true"
								className="h-4 w-4 text-danger"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
							<h2 className="text-xs font-semibold uppercase tracking-widest text-danger">
								Delete
							</h2>
						</div>
						<p className="text-xs text-text-faint">
							Permanently remove this {modelLabel.toLowerCase()}. This cannot be
							undone.
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

function formatDate(date) {
	if (!date) return "\u2014";
	return new Date(date).toLocaleDateString("en-GB", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
