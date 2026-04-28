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
		<form action={formAction} className="max-w-xl space-y-5">
			{/* Drop zone */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: file drop zone with keyboard accessible input */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard access provided via the hidden file input */}
			<div
				className={`rounded-[--radius-default] border-2 border-dashed transition-colors cursor-pointer ${
					dragOver
						? "border-primary bg-primary/5"
						: "border-border hover:border-border-hover"
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
							className="max-h-48 max-w-full rounded object-contain"
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
						<p className="text-xs text-text-faint">Images, PDFs — max 10 MB</p>
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

			{/* Alt text */}
			<div className="flex flex-col gap-1">
				<Label htmlFor="media-alt">Alt text</Label>
				<Input
					id="media-alt"
					type="text"
					name="alt"
					placeholder="Describe the image for screen readers"
				/>
			</div>

			{state?.error && <p className="text-sm text-danger">{state.error}</p>}

			<div className="flex items-center gap-3">
				<Button type="submit" disabled={isPending}>
					{isPending ? "Uploading…" : "Upload file"}
				</Button>
				<a
					href="/admin/cms/media"
					className="text-sm text-text-faint hover:text-text"
				>
					Cancel
				</a>
			</div>
		</form>
	);
}
