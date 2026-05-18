"use client";

import { Button, Dialog, Input, Label, Textarea } from "@techstream/quark-ui";
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
	const [body, setBody] = useState(record?.body ?? "");
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, startDeleteTransition] = useTransition();

	const status = record?.status ?? "DRAFT";
	const canPublish = status === "DRAFT";
	const canArchive = status === "PUBLISHED";
	const canUnpublish = status === "PUBLISHED";
	const isPageModel = modelLabel === "Page";

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
			<form id={formId} action={formAction} className="space-y-4 min-w-0">
				<section className="rounded-[--radius-default] border border-border bg-surface p-4 shadow-sm sm:p-5">
					<PanelHeader
						title="Details"
						description="Core page metadata and URL settings."
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
								placeholder={`${modelLabel} title`}
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
									defaultValue={record?.excerpt ?? ""}
									rows={2}
									placeholder="Short summary (optional)"
								/>
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
						/>
						<p className="px-1 text-xs text-text-faint">
							Use sections to shape the public page instead of writing one long
							body field.
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

			<aside className="space-y-4 lg:sticky lg:-top-2 lg:self-start">
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

				<ContentPreview body={isPageModel ? (record?.body ?? "") : body} />
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
