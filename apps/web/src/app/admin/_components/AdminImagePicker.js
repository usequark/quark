"use client";

import { Button, Dialog, Input, Label, Lightbox } from "@techstream/quark-ui";
import { useActionState, useEffect, useRef, useState } from "react";
import { cmsUploadMediaInline } from "../cms/_actions/media";

/**
 * Unified image picker for admin forms.
 *
 * Replaces the three-tab (Media / Upload / URL) pattern with a single panel:
 *   - Primary body: scrollable media library grid
 *   - Footer left: click-to-upload with inline preview & confirm
 *   - Footer right: paste-a-URL with instant "Use" action
 *
 * Emits the chosen URL as a hidden `<input name={name}>` and/or calls `onChange`.
 *
 * @param {{
 *   label?: string,
 *   name?: string,
 *   defaultValue?: string,
 *   disabled?: boolean,
 *   onChange?: (value: string) => void
 * }} props
 */
export default function AdminImagePicker({
	label,
	name,
	defaultValue = "",
	disabled = false,
	onChange,
	onAltChange,
}) {
	const [value, setValue] = useState(defaultValue);
	const [open, setOpen] = useState(false);
	const [lightboxOpen, setLightboxOpen] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const [mediaAssets, setMediaAssets] = useState(null);
	const [loadingMedia, setLoadingMedia] = useState(false);
	const [uploadPreview, setUploadPreview] = useState(null);
	const uploadInputRef = useRef(null);

	const [uploadState, uploadAction, isUploading] = useActionState(
		async (_prev, formData) => {
			const result = await cmsUploadMediaInline(_prev, formData);
			if (result?.url) {
				applyValue(result.url);
				setOpen(false);
				setUploadPreview(null);
				return { error: null };
			}
			return { error: result?.error ?? "Upload failed" };
		},
		{ error: null },
	);

	function applyValue(nextValue) {
		setValue((current) => (current === nextValue ? current : nextValue));
		onChange?.(nextValue);
	}

	// Load media library when the panel first opens
	useEffect(() => {
		if (open && mediaAssets === null && !loadingMedia) {
			setLoadingMedia(true);
			fetch("/api/cms/media")
				.then((r) => r.json())
				.then((data) => setMediaAssets(data.assets ?? []))
				.catch(() => setMediaAssets([]))
				.finally(() => setLoadingMedia(false));
		}
	}, [open, mediaAssets, loadingMedia]);

	useEffect(() => {
		setValue(defaultValue);
	}, [defaultValue]);

	function handleSelectMedia(asset) {
		applyValue(`/api/media/${encodeURIComponent(asset.storageKey)}`);
		onAltChange?.(asset.alt ?? "");
		setOpen(false);
	}

	function handleUrlConfirm() {
		const trimmed = urlInput.trim();
		if (!trimmed) return;
		applyValue(trimmed);
		setOpen(false);
		setUrlInput("");
	}

	function handleUploadFileChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => setUploadPreview(ev.target.result);
		reader.readAsDataURL(file);
	}

	function handleClose() {
		setOpen(false);
		setUploadPreview(null);
	}

	const showImage =
		value &&
		(/\.(jpe?g|png|gif|webp|avif|svg)$/i.test(value) ||
			value.startsWith("/api/media/"));

	return (
		<div className="flex flex-col gap-1.5">
			{label && <Label>{label}</Label>}

			{/* ── Selected state ─────────────────────────────── */}
			{value && (
				<div className="flex flex-col sm:flex-row items-stretch gap-3 p-2.5 rounded-[--radius-default] border border-border bg-surface">
					<button
						type="button"
						onClick={() => setLightboxOpen(true)}
						className="w-full sm:w-44 h-32 rounded border border-border bg-surface-hover overflow-hidden shrink-0 flex items-center justify-center cursor-pointer"
						aria-label="Open image preview"
					>
						{showImage ? (
							// biome-ignore lint/performance/noImgElement: dynamic/blob URL
							<img
								src={value}
								alt="Selected"
								className="w-full h-full object-contain"
							/>
						) : (
							<span className="text-[10px] font-mono text-text-faint text-center break-all px-2">
								URL
							</span>
						)}
					</button>
					<div className="flex flex-col justify-center gap-1.5 min-w-0 flex-1">
						<p className="text-[11px] font-mono text-text-muted truncate leading-none">
							{value}
						</p>
						{!disabled && (
							<div className="flex items-center gap-3 flex-wrap">
								<Button
									type="button"
									onClick={() => setOpen(true)}
									variant="outline"
									size="sm"
									className=" h-auto! py-1!"
								>
									Change
								</Button>
								<Button
									type="button"
									onClick={() => applyValue("")}
									variant="secondary"
									size="sm"
									className="border-red-500 text-red-500! hover:bg-red-50! h-auto! py-1!"
								>
									Remove
								</Button>
							</div>
						)}
					</div>
				</div>
			)}

			{/* ── Empty trigger ───────────────────────────────── */}
			{!value && !disabled && (
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="group flex items-center justify-center gap-2.5 w-full rounded-[--radius-default] border border-dashed border-border hover:border-primary bg-surface hover:bg-surface-hover transition-all duration-150 py-5 text-sm text-text-faint hover:text-text"
				>
					<svg
						aria-hidden="true"
						className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110"
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
					<span>Choose image</span>
				</button>
			)}

			{/* Hidden form input */}
			{name ? <input type="hidden" name={name} value={value} /> : null}

			{/* ── Lightbox ────────────────────────────────────── */}
			{showImage && (
				<Lightbox
					src={value}
					alt="Selected image"
					open={lightboxOpen}
					onClose={() => setLightboxOpen(false)}
				/>
			)}

			{/* ── Picker dialog ───────────────────────────────── */}
			<Dialog
				open={open}
				onClose={handleClose}
				title="Choose Image"
				className="max-w-xl!"
			>
				<div className="flex flex-col">
					{/* Media grid */}
					<div className="min-h-24 max-h-60 overflow-y-auto">
						{loadingMedia && (
							<div className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-2">
								{Array.from({ length: 10 }).map((_, i) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton loaders
										key={i}
										className="aspect-square rounded border border-border bg-surface-hover animate-pulse"
									/>
								))}
							</div>
						)}

						{!loadingMedia && mediaAssets?.length === 0 && (
							<div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
								<svg
									className="w-8 h-8 text-text-faint/40"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth="1"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
									/>
								</svg>
								<p className="text-xs text-text-faint">
									No images in the library yet.
									<br />
									Upload one below.
								</p>
							</div>
						)}

						{!loadingMedia && mediaAssets && mediaAssets.length > 0 && (
							<div className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-2">
								{mediaAssets.map((asset) => (
									<button
										key={asset.id}
										type="button"
										onClick={() => handleSelectMedia(asset)}
										className="aspect-square rounded border border-border hover:border-primary hover:ring-2 hover:ring-primary/20 bg-surface-hover overflow-hidden transition-all duration-100"
										title={asset.alt ?? asset.filename}
									>
										{/* biome-ignore lint/performance/noImgElement: dynamic API URL */}
										<img
											src={`/api/media/${encodeURIComponent(asset.storageKey)}`}
											alt={asset.alt ?? asset.filename}
											className="w-full h-full object-cover"
										/>
									</button>
								))}
							</div>
						)}
					</div>

					{/* Footer: Upload | URL */}
					<div className="border-t border-border grid grid-cols-2 divide-x divide-border">
						{/* Left: Upload */}
						<div className="p-2.5 flex flex-col gap-2">
							<p className="text-[10px] font-semibold tracking-widest uppercase text-text-faint select-none">
								Upload
							</p>
							<button
								type="button"
								onClick={() => uploadInputRef.current?.click()}
								className="flex items-center gap-2 px-2 py-1.5 rounded border border-border hover:border-border-hover hover:bg-surface-hover transition-colors text-xs text-text-faint hover:text-text w-full text-left"
							>
								{uploadPreview ? (
									// biome-ignore lint/performance/noImgElement: dynamic/blob URL preview
									<img
										src={uploadPreview}
										alt="Upload preview"
										className="w-7 h-7 rounded object-cover shrink-0"
									/>
								) : (
									<svg
										aria-hidden="true"
										className="w-4 h-4 shrink-0"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth="1.5"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
										/>
									</svg>
								)}
								<span className="truncate">
									{uploadPreview ? "File selected" : "Choose file…"}
								</span>
							</button>
							<input
								ref={uploadInputRef}
								type="file"
								name="file"
								accept="image/*"
								className="sr-only"
								onChange={handleUploadFileChange}
							/>
							{uploadState?.error && (
								<p className="text-[11px] text-danger leading-tight">
									{uploadState.error}
								</p>
							)}
							{uploadPreview && (
								<Button
									type="submit"
									formAction={uploadAction}
									formNoValidate
									disabled={isUploading}
									size="sm"
									variant="outline"
									className="w-full text-xs font-medium py-1.5 px-2 my-auto!"
								>
									{isUploading ? "Uploading…" : "Upload & use"}
								</Button>
							)}
						</div>

						{/* Right: URL */}
						<div className="p-2.5 flex flex-col gap-2">
							<p className="text-[10px] font-semibold tracking-widest uppercase text-text-faint select-none">
								Paste URL
							</p>
							<Input
								type="url"
								value={urlInput}
								onChange={(e) => setUrlInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleUrlConfirm();
									}
								}}
								placeholder="https://example.com/img.jpg"
								className="text-xs h-8"
							/>
							{urlInput && /^https?:\/\//i.test(urlInput) && (
								<div className="rounded border border-border overflow-hidden bg-surface-hover h-16 flex items-center justify-center">
									{/* biome-ignore lint/performance/noImgElement: dynamic URL preview, next/image not applicable */}
									<img
										src={urlInput}
										alt="URL preview"
										className="max-h-full max-w-full object-contain"
										onError={(e) => {
											e.target.style.display = "none";
										}}
									/>
								</div>
							)}
							<Button
								type="button"
								onClick={handleUrlConfirm}
								disabled={!urlInput.trim()}
								size="sm"
								variant="outline"
								className="w-full text-xs font-medium py-1.5 px-2 my-auto!"
							>
								Use URL
							</Button>
						</div>
					</div>
				</div>
			</Dialog>
		</div>
	);
}
