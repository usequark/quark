"use client";

import { Button, Input, Label, Lightbox } from "@techstream/quark-ui";
import { FileText, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useActionState, useRef, useState } from "react";

const initialState = { error: null };

/**
 * Shared form for uploading new media and editing existing media metadata.
 */
export default function MediaEditorForm({
	mode,
	asset,
	submitAction,
	deleteAction,
	backHref = "/admin/cms/media",
}) {
	const [state, formAction, isPending] = useActionState(
		async (_prev, formData) => {
			try {
				await submitAction(_prev, formData);
				return { error: null };
			} catch (err) {
				if (
					typeof err?.digest === "string" &&
					err.digest.startsWith("NEXT_REDIRECT")
				) {
					throw err;
				}
				return { error: err?.message ?? "Request failed" };
			}
		},
		initialState,
	);

	const isEdit = mode === "edit";
	const assetUrl = asset
		? `/api/media/${encodeURIComponent(asset.storageKey)}`
		: null;

	return (
		<form
			action={formAction}
			className="max-w-5xl grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start"
		>
			<div className="rounded-[--radius-default] border border-border bg-surface p-4 sm:p-5 space-y-4">
				<div>
					<h2 className="text-sm font-semibold text-text">File details</h2>
					<p className="text-xs text-text-faint mt-1">
						{isEdit
							? "Review the uploaded asset and update alt text."
							: "Upload an image or PDF, then add optional alt text."}
					</p>
				</div>

				{isEdit ? (
					<CurrentAssetPanel asset={asset} assetUrl={assetUrl} />
				) : (
					<UploadDropzone />
				)}

				<div className="rounded-[--radius-default] border border-border bg-surface-hover/30 p-3 sm:p-4">
					<Label htmlFor="media-alt">Alt text</Label>
					<Input
						id="media-alt"
						type="text"
						name="alt"
						placeholder="Describe the image for screen readers"
						className="mt-2"
						defaultValue={isEdit ? (asset?.alt ?? "") : ""}
					/>
				</div>
			</div>

			<div className="space-y-4">
				{state?.error && (
					<div className="rounded-[--radius-default] border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
						{state.error}
					</div>
				)}

				<div className="rounded-[--radius-default] border border-border bg-surface p-4 sm:p-5">
					<p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
						Actions
					</p>
					<div className="mt-3 grid grid-cols-1 gap-3">
						<Button type="submit" disabled={isPending} className="w-full">
							{isPending
								? isEdit
									? "Saving..."
									: "Uploading..."
								: isEdit
									? "Save changes"
									: "Upload file"}
						</Button>
						{isEdit && deleteAction ? (
							<Button
								type="submit"
								variant="danger"
								formAction={deleteAction}
								onClick={(event) => {
									if (
										!confirm("Delete this media asset? This cannot be undone.")
									) {
										event.preventDefault();
									}
								}}
								className="w-full"
							>
								Delete asset
							</Button>
						) : null}
						<Button
							type="button"
							variant="secondary"
							onClick={() => {
								window.location.href = backHref;
							}}
							className="w-full"
						>
							Cancel
						</Button>
					</div>
				</div>
			</div>
		</form>
	);
}

function UploadDropzone() {
	const [dragOver, setDragOver] = useState(false);
	const [preview, setPreview] = useState(null);
	const [fileName, setFileName] = useState(null);
	const inputRef = useRef(null);

	function handleFile(file) {
		if (!file) return;
		setFileName(file.name);
		if (file.type.startsWith("image/")) {
			const reader = new FileReader();
			reader.onload = (event) => setPreview(event.target?.result ?? null);
			reader.readAsDataURL(file);
		} else {
			setPreview(null);
		}
	}

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: file drop zone with keyboard accessible input */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard access provided via the hidden file input */}
			<div
				className={`rounded-[--radius-default] border-2 border-dashed transition-colors cursor-pointer ${
					dragOver
						? "border-primary bg-primary/5"
						: "border-border bg-surface-hover/40 hover:border-border-hover"
				}`}
				onDragOver={(event) => {
					event.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={(event) => {
					event.preventDefault();
					setDragOver(false);
					const file = event.dataTransfer.files[0];
					if (file && inputRef.current) {
						const dt = new DataTransfer();
						dt.items.add(file);
						inputRef.current.files = dt.files;
						handleFile(file);
					}
				}}
				onClick={() => inputRef.current?.click()}
			>
				{preview ? (
					<div className="p-4 flex flex-col items-center gap-2">
						{/* biome-ignore lint/performance/noImgElement: data URL preview cannot be optimized by next/image */}
						<img
							src={preview}
							alt="Preview"
							className="max-h-52 max-w-full rounded object-contain"
						/>
						<p className="text-sm text-text-muted">{fileName}</p>
					</div>
				) : (
					<div className="p-10 flex flex-col items-center gap-2 text-center">
						<svg
							aria-hidden="true"
							className="w-8 h-8 text-text-faint"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="1.5"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
							/>
						</svg>
						<p className="text-sm font-medium text-text">
							{fileName ?? "Click to select or drag a file here"}
						</p>
						<p className="text-xs text-text-faint">Images, PDFs - max 10 MB</p>
					</div>
				)}
			</div>

			<input
				ref={inputRef}
				type="file"
				name="file"
				accept="image/*,application/pdf"
				className="sr-only"
				required
				onChange={(event) => handleFile(event.target.files?.[0])}
			/>
		</>
	);
}

function CurrentAssetPanel({ asset, assetUrl }) {
	const [lightboxOpen, setLightboxOpen] = useState(false);

	if (!asset || !assetUrl) return null;

	const isImage = asset.mimeType.startsWith("image/");
	const isSvg = asset.mimeType === "image/svg+xml";
	const isPdf = asset.mimeType === "application/pdf";

	return (
		<>
			{isImage && !isSvg ? (
				<>
					<button
						type="button"
						onClick={() => setLightboxOpen(true)}
						className="group relative w-full rounded-[--radius-default] border border-border bg-surface-hover/40 overflow-hidden cursor-zoom-in"
					>
						<div className="relative aspect-[4/3] w-full">
							<Image
								fill
								src={assetUrl}
								alt={asset.alt ?? asset.filename}
								className="object-contain"
								sizes="(max-width: 1024px) 100vw, 70vw"
							/>
						</div>
						<span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-[--radius-default] border border-white/40 bg-black/45 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
							<ZoomIn aria-hidden="true" className="size-3" />
							Preview
						</span>
					</button>
					<Lightbox
						src={assetUrl}
						alt={asset.alt ?? asset.filename}
						caption={asset.filename}
						open={lightboxOpen}
						onClose={() => setLightboxOpen(false)}
					/>
				</>
			) : isSvg ? (
				<button
					type="button"
					onClick={() => setLightboxOpen(true)}
					className="group relative rounded-[--radius-default] border border-border bg-surface-hover/40 p-4 flex items-center justify-center min-h-56 cursor-zoom-in"
				>
					{/* biome-ignore lint/performance/noImgElement: SVGs should render as original files */}
					<img
						src={assetUrl}
						alt={asset.alt ?? asset.filename}
						className="max-h-56 w-auto object-contain"
					/>
					<span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-[--radius-default] border border-white/40 bg-black/45 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
						<ZoomIn aria-hidden="true" className="size-3" />
						Preview
					</span>
				</button>
			) : isPdf ? (
				<a
					href={assetUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="rounded-[--radius-default] border border-border bg-surface-hover/40 p-8 flex flex-col items-center justify-center gap-2 min-h-56 hover:border-border-hover transition-colors"
				>
					<FileText aria-hidden="true" className="w-10 h-10 text-danger/70" />
					<span className="text-sm font-medium text-text">Open PDF</span>
				</a>
			) : (
				<div className="rounded-[--radius-default] border border-border bg-surface-hover/40 p-8 flex flex-col items-center justify-center gap-2 min-h-56 text-center">
					<FileText aria-hidden="true" className="w-10 h-10 text-text-faint" />
					<span className="text-sm font-medium text-text">
						{asset.filename}
					</span>
					<span className="text-xs text-text-faint">{asset.mimeType}</span>
				</div>
			)}

			{isSvg && (
				<Lightbox
					src={assetUrl}
					alt={asset.alt ?? asset.filename}
					caption={asset.filename}
					open={lightboxOpen}
					onClose={() => setLightboxOpen(false)}
				/>
			)}
		</>
	);
}
