"use client";

import { Button, Input, Label, Textarea } from "@techstream/quark-ui";
import { useActionState, useState } from "react";
import CoverImageField from "./CoverImageField";
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

	const status = record?.status ?? "DRAFT";
	const canPublish = status === "DRAFT";
	const canArchive = status === "PUBLISHED";
	const canUnpublish = status === "PUBLISHED";

	return (
		<div className="flex flex-col gap-6 lg:flex-row lg:items-start">
			{/* Main editor — takes 2/3 width on large screens */}
			<div className="flex-1 min-w-0">
				<form action={formAction} className="space-y-5">
					{/* Title */}
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
								placeholder="Short summary (optional)"
							/>
						</div>
					)}

					{/* Cover image picker */}
					{hasCoverImage && (
						<CoverImageField defaultValue={record?.coverImage ?? ""} />
					)}

					{/* Body */}
					<div className="flex flex-col gap-1">
						<Label htmlFor="cms-body">Body *</Label>
						<Textarea
							id="cms-body"
							name="body"
							defaultValue={record?.body ?? ""}
							required
							rows={16}
							placeholder="Write your content here…"
							className="font-mono text-sm leading-relaxed resize-y"
						/>
						<p className="text-xs text-text-faint">
							Plain text or HTML. Use the rich text upgrade path (Tiptap) for a
							visual editor.
						</p>
					</div>

					<div className="flex items-center gap-3 pt-4 border-t border-border">
						<Button type="submit" disabled={isPending}>
							{isPending
								? "Saving…"
								: isEdit
									? "Save changes"
									: `Create ${modelLabel}`}
						</Button>
						<a href="./" className="text-sm text-text-faint hover:text-text">
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
						<form action={deleteAction}>
							<Button
								type="submit"
								variant="danger"
								className="w-full"
								onClick={(e) => {
									if (
										!confirm(
											`Delete this ${modelLabel}? This cannot be undone.`,
										)
									)
										e.preventDefault();
								}}
							>
								Delete {modelLabel}
							</Button>
						</form>
					</div>
				)}
			</aside>
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
