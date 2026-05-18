"use client";

import { Button, Input, Label } from "@techstream/quark-ui";
import { useActionState, useRef, useState } from "react";
import { cmsUploadMedia } from "../../_actions/media";

const initialState = { error: null };

export default function MediaUploadPage() {
	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/cms/media"
					className="text-sm text-text-faint hover:text-text"
				>
					← Media Library
				</a>
				<h1 className="text-2xl font-bold mt-1 text-text">Upload Media</h1>
			</div>
			<MediaUploadForm />
		</div>
	);
}

function MediaUploadForm() {
	const [state, formAction, isPending] = useActionState(
		async (_prev, formData) => {
			try {
				await cmsUploadMedia(_prev, formData);
				return { error: null };
			} catch (err) {
				return { error: err?.message ?? "Upload failed" };
			}
		},
		initialState,
	);

	const [dragOver, setDragOver] = useState(false);
	const [preview, setPreview] = useState(null);
	const [fileName, setFileName] = useState(null);
	const inputRef = useRef(null);

	function handleFile(file) {
		if (!file) return;
		setFileName(file.name);
		if (file.type.startsWith("image/")) {
			const reader = new FileReader();
			reader.onload = (e) => setPreview(e.target.result);
			reader.readAsDataURL(file);
		} else {
			setPreview(null);
		}
	}

	return (
		<form
			action={formAction}
			className="max-w-5xl grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start"
		>
			<div className="rounded-[--radius-default] border border-border bg-surface p-4 sm:p-5 space-y-4">
				<div>
					<h2 className="text-sm font-semibold text-text">File details</h2>
					<p className="text-xs text-text-faint mt-1">
						Upload an image or PDF, then add optional alt text.
					</p>
				</div>

				{/* biome-ignore lint/a11y/noStaticElementInteractions: file drop zone with keyboard accessible input */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard access provided via the hidden file input */}
				<div
					className={`rounded-[--radius-default] border-2 border-dashed transition-colors cursor-pointer ${
						dragOver
							? "border-primary bg-primary/5"
							: "border-border bg-surface-hover/40 hover:border-border-hover"
					}`}
					onDragOver={(e) => {
						e.preventDefault();
						setDragOver(true);
					}}
					onDragLeave={() => setDragOver(false)}
					onDrop={(e) => {
						e.preventDefault();
						setDragOver(false);
						const file = e.dataTransfer.files[0];
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
							<p className="text-xs text-text-faint">
								Images, PDFs - max 10 MB
							</p>
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
					onChange={(e) => handleFile(e.target.files?.[0])}
				/>

				<div className="rounded-[--radius-default] border border-border bg-surface-hover/30 p-3 sm:p-4">
					<Label htmlFor="media-alt">Alt text</Label>
					<Input
						id="media-alt"
						type="text"
						name="alt"
						placeholder="Describe the image for screen readers"
						className="mt-2"
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
							{isPending ? "Uploading…" : "Upload file"}
						</Button>
						<Button
							type="button"
							variant="danger"
							onClick={() => {
								window.location.href = "/admin/cms/media";
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
