"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { cmsUploadMediaInline } from "../cms/_actions/media";

/**
 * Neutral image picker for admin forms.
 *
 * Replaces the themed quark-ui picker with plain HTML. Emits the chosen URL as
 * a hidden `<input name={name}>` and/or calls `onChange`.
 *
 * @param {{
 *   label?: string,
 *   name?: string,
 *   defaultValue?: string,
 *   disabled?: boolean,
 *   onChange?: (value: string) => void,
 *   onAltChange?: (value: string) => void,
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

	const inputClass =
		"w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-500";

	return (
		<div className="flex flex-col gap-1.5">
			{label && (
				<label className="block text-sm font-medium text-gray-700">
					{label}
				</label>
			)}

			{value && (
				<div className="flex flex-col sm:flex-row items-stretch gap-3 rounded-md border border-gray-200 bg-white p-2.5">
					<div className="flex h-32 w-full sm:w-44 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
						{showImage ? (
							// biome-ignore lint/performance/noImgElement: dynamic/blob URL
							<img
								src={value}
								alt="Selected"
								className="h-full w-full object-contain"
							/>
						) : (
							<span className="break-all px-2 text-center text-[10px] font-mono text-gray-400">
								URL
							</span>
						)}
					</div>
					<div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
						<p className="truncate text-[11px] font-mono text-gray-500 leading-none">
							{value}
						</p>
						{!disabled && (
							<div className="flex flex-wrap items-center gap-3">
								<button
									type="button"
									onClick={() => setOpen(true)}
									className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
								>
									Change
								</button>
								<button
									type="button"
									onClick={() => applyValue("")}
									className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
								>
									Remove
								</button>
							</div>
						)}
					</div>
				</div>
			)}

			{!value && !disabled && (
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="flex w-full items-center justify-center gap-2.5 rounded-md border border-dashed border-gray-300 bg-white py-5 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700"
				>
					<svg
						aria-hidden="true"
						className="h-4 w-4 shrink-0"
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

			{name ? <input type="hidden" name={name} value={value} /> : null}

			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-lg bg-white">
						<div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
							<h2 className="text-base font-semibold text-gray-900">
								Choose Image
							</h2>
							<button
								type="button"
								onClick={handleClose}
								className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
								aria-label="Close"
							>
								<svg
									aria-hidden="true"
									className="h-5 w-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>

						<div className="flex flex-col overflow-hidden">
							<div className="min-h-24 max-h-60 overflow-y-auto p-4">
								{loadingMedia && (
									<div className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-2">
										{Array.from({ length: 10 }).map((_, i) => (
											<div
												// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton loaders
												key={i}
												className="aspect-square animate-pulse rounded border border-gray-200 bg-gray-100"
											/>
										))}
									</div>
								)}

								{!loadingMedia && mediaAssets?.length === 0 && (
									<div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
										<p className="text-xs text-gray-500">
											No images in the library yet. Upload one below.
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
												className="aspect-square overflow-hidden rounded border border-gray-200 bg-gray-50 hover:border-gray-400"
												title={asset.alt ?? asset.filename}
											>
												{/* biome-ignore lint/performance/noImgElement: dynamic API URL */}
												<img
													src={`/api/media/${encodeURIComponent(asset.storageKey)}`}
													alt={asset.alt ?? asset.filename}
													className="h-full w-full object-cover"
												/>
											</button>
										))}
									</div>
								)}
							</div>

							<div className="grid grid-cols-2 divide-x divide-gray-200 border-t border-gray-200">
								<div className="flex flex-col gap-2 p-2.5">
									<p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
										Upload
									</p>
									<button
										type="button"
										onClick={() => uploadInputRef.current?.click()}
										className="flex w-full items-center gap-2 rounded border border-gray-300 px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-900"
									>
										{uploadPreview ? (
											// biome-ignore lint/performance/noImgElement: dynamic/blob URL preview
											<img
												src={uploadPreview}
												alt="Upload preview"
												className="h-7 w-7 shrink-0 rounded object-cover"
											/>
										) : (
											<svg
												aria-hidden="true"
												className="h-4 w-4 shrink-0"
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
										<p className="text-[11px] leading-tight text-red-600">
											{uploadState.error}
										</p>
									)}
									{uploadPreview && (
										<button
											type="submit"
											formAction={uploadAction}
											formNoValidate
											disabled={isUploading}
											className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
										>
											{isUploading ? "Uploading…" : "Upload & use"}
										</button>
									)}
								</div>

								<div className="flex flex-col gap-2 p-2.5">
									<p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
										Paste URL
									</p>
									<input
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
										className={inputClass}
									/>
									{urlInput && /^https?:\/\//i.test(urlInput) && (
										<div className="flex h-16 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
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
									<button
										type="button"
										onClick={handleUrlConfirm}
										disabled={!urlInput.trim()}
										className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
									>
										Use URL
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
