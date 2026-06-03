"use client";

import { Button, Card, CardContent, Input, Label } from "@techstream/quark-ui";
import { useActionState, useEffect, useRef, useState } from "react";
import { cmsUploadMediaInline } from "../cms/_actions/media";

const TABS = ["Media", "Upload", "URL"];

/**
 * Image field for admin model forms with three selection modes:
 * - Media: pick from existing uploaded media assets
 * - Upload: upload a new file directly to the media library
 * - URL: paste an external image URL
 *
 * Submits the image URL as a hidden input under `name`.
 *
 * @param {{
 *   label: string,
 *   name: string,
 *   defaultValue?: string,
 *   disabled?: boolean
 * }} props
 */
export default function AdminImageField({
	label,
	name,
	defaultValue = "",
	disabled = false,
}) {
	function applyValue(nextValue) {
		setValue((current) => (current === nextValue ? current : nextValue));
	}

	const [value, setValue] = useState(defaultValue);
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState("Media");
	const [urlInput, setUrlInput] = useState(defaultValue);
	const [mediaAssets, setMediaAssets] = useState(null);
	const [loadingMedia, setLoadingMedia] = useState(false);
	const [uploadState, uploadAction, isUploading] = useActionState(
		async (_prev, formData) => {
			const result = await cmsUploadMediaInline(_prev, formData);
			if (result?.url) {
				applyValue(result.url);
				setOpen(false);
				return { error: null };
			}
			return { error: result?.error ?? "Upload failed" };
		},
		{ error: null },
	);
	const uploadInputRef = useRef(null);
	const [uploadPreview, setUploadPreview] = useState(null);

	useEffect(() => {
		if (open && tab === "Media" && mediaAssets === null && !loadingMedia) {
			setLoadingMedia(true);
			fetch("/api/cms/media")
				.then((r) => r.json())
				.then((data) => setMediaAssets(data.assets ?? []))
				.catch(() => setMediaAssets([]))
				.finally(() => setLoadingMedia(false));
		}
	}, [open, tab, mediaAssets, loadingMedia]);

	useEffect(() => {
		setValue(defaultValue);
		setUrlInput(defaultValue);
	}, [defaultValue]);

	function handleSelectMedia(asset) {
		applyValue(`/api/media/${encodeURIComponent(asset.storageKey)}`);
		setOpen(false);
	}

	function handleUrlConfirm() {
		applyValue(urlInput);
		setOpen(false);
	}

	function handleUploadFileChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => setUploadPreview(ev.target.result);
		reader.readAsDataURL(file);
	}

	const isImage = value && /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(value);
	const isApiMedia = value?.startsWith("/api/media/");

	return (
		<div className="flex flex-col gap-1.5">
			<Label>{label}</Label>

			{/* Current value preview */}
			{value ? (
				<div className="flex items-start gap-3">
					<div className="w-20 h-20 rounded-[--radius-default] border border-border bg-surface-hover overflow-hidden shrink-0 flex items-center justify-center">
						{isImage || isApiMedia ? (
							// biome-ignore lint/performance/noImgElement: dynamic/blob URL
							<img
								src={value}
								alt="Selected field value"
								className="w-full h-full object-cover"
							/>
						) : (
							<span className="text-[10px] font-mono text-text-faint text-center break-all px-1">
								URL set
							</span>
						)}
					</div>
					<div className="flex flex-col gap-1.5 pt-1">
						<p className="text-xs text-text-muted truncate max-w-[12rem]">
							{value}
						</p>
						<div className="flex gap-2">
							{!disabled && (
								<button
									type="button"
									onClick={() => setOpen(true)}
									className="text-xs text-primary hover:opacity-75 transition-opacity"
								>
									Change
								</button>
							)}
							{!disabled && (
								<button
									type="button"
									onClick={() => applyValue("")}
									className="text-xs text-danger hover:opacity-75 transition-opacity"
								>
									Remove
								</button>
							)}
						</div>
					</div>
				</div>
			) : (
				!disabled && (
					<button
						type="button"
						onClick={() => setOpen(true)}
						className="flex items-center justify-center gap-2 w-full rounded-[--radius-default] border border-dashed border-border hover:border-border-hover bg-surface hover:bg-surface-hover transition-colors py-4 text-sm text-text-faint hover:text-text"
					>
						<svg
							aria-hidden="true"
							className="w-4 h-4 shrink-0"
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
						Choose image
					</button>
				)
			)}

			{/* Hidden input carries the value into the form */}
			<input type="hidden" name={name} value={value} />

			{/* Picker panel */}
			{open && (
				<div className="rounded-[--radius-default] border border-border bg-surface shadow-lg overflow-hidden">
					{/* Tabs */}
					<div className="flex border-b border-border">
						{TABS.map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => setTab(t)}
								className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
									tab === t
										? "border-b-2 border-primary text-text -mb-px"
										: "text-text-faint hover:text-text"
								}`}
							>
								{t}
							</button>
						))}
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="px-3 text-text-faint hover:text-text transition-colors"
							aria-label="Close picker"
						>
							✕
						</button>
					</div>

					{/* Tab: Media */}
					{tab === "Media" && (
						<div className="p-3">
							{loadingMedia && (
								<p className="text-xs text-text-faint text-center py-6">
									Loading…
								</p>
							)}
							{!loadingMedia && mediaAssets?.length === 0 && (
								<Card>
									<CardContent className="py-6 text-center">
										<p className="mb-3 text-xs text-text-faint">
											No images in the media library yet.
										</p>
										<Button
											type="button"
											variant="secondary"
											size="sm"
											onClick={() => setTab("Upload")}
										>
											Upload one
										</Button>
									</CardContent>
								</Card>
							)}
							{!loadingMedia && mediaAssets && mediaAssets.length > 0 && (
								<div className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2 max-h-64 overflow-y-auto">
									{mediaAssets.map((asset) => (
										<button
											key={asset.id}
											type="button"
											onClick={() => handleSelectMedia(asset)}
											className="aspect-square rounded border border-border hover:border-primary bg-surface-hover overflow-hidden transition-colors"
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
					)}

					{/* Tab: Upload */}
					{tab === "Upload" && (
						<div className="p-3">
							<div className="space-y-3">
								<button
									type="button"
									className="w-full rounded-[--radius-default] border-2 border-dashed border-border hover:border-border-hover transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 py-6 text-sm text-text-faint"
									onClick={() => uploadInputRef.current?.click()}
								>
									{uploadPreview ? (
										// biome-ignore lint/performance/noImgElement: dynamic/blob URL
										<img
											src={uploadPreview}
											alt="Upload preview"
											className="max-h-32 max-w-full rounded object-contain"
										/>
									) : (
										<>
											<svg
												aria-hidden="true"
												className="w-6 h-6"
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
											<span>Click to select an image</span>
										</>
									)}
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
									<p className="text-xs text-danger">{uploadState.error}</p>
								)}
								<Button
									type="submit"
									formAction={uploadAction}
									formNoValidate
									disabled={isUploading}
									className="w-full"
								>
									{isUploading ? "Uploading…" : "Upload & select"}
								</Button>
							</div>
						</div>
					)}

					{/* Tab: URL */}
					{tab === "URL" && (
						<div className="p-3 space-y-3">
							<Input
								type="url"
								value={urlInput}
								onChange={(e) => setUrlInput(e.target.value)}
								placeholder="https://example.com/image.jpg"
								autoFocus
							/>
							{urlInput && /^https?:\/\//i.test(urlInput) && (
								<div className="rounded border border-border overflow-hidden bg-surface-hover h-28 flex items-center justify-center">
									{/* biome-ignore lint/performance/noImgElement: dynamic URL, next/image not applicable */}
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
								disabled={!urlInput}
								className="w-full"
							>
								Use this URL
							</Button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
