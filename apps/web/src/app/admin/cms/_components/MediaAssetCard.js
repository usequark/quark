import { FileText } from "lucide-react";
import Image from "next/image";
import DeleteMediaButton from "./DeleteMediaButton";

/**
 * Shared media asset card used in the CMS overview and media library.
 *
 * @param {object} props
 * @param {object} props.asset
 * @param {string} props.asset.id
 * @param {string} props.asset.filename
 * @param {string} props.asset.storageKey
 * @param {string} props.asset.mimeType
 * @param {number} props.asset.size
 * @param {string | null} [props.asset.alt]
 * @param {string} [props.href]
 * @param {() => Promise<void>} [props.deleteAction]
 */
export default function MediaAssetCard({ asset, href, deleteAction }) {
	const isPdf = asset.mimeType === "application/pdf";
	const isSvg = asset.mimeType === "image/svg+xml";
	const isImage = asset.mimeType.startsWith("image/");
	const assetUrl = `/api/media/${encodeURIComponent(asset.storageKey)}`;
	const card = (
		<div className="group relative rounded-[--radius-default] border border-border bg-surface overflow-hidden hover:border-primary transition-colors">
			<div className="relative aspect-square bg-surface-hover flex items-center justify-center overflow-hidden">
				{isImage && !isSvg ? (
					<Image
						fill
						src={assetUrl}
						alt={asset.alt ?? asset.filename}
						className="object-cover"
						sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
					/>
				) : isSvg ? (
					// biome-ignore lint/performance/noImgElement: SVGs need unoptimized rendering
					<img
						src={assetUrl}
						alt={asset.alt ?? asset.filename}
						className="object-contain w-full h-full p-2"
					/>
				) : isPdf && !href ? (
					<a
						href={assetUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="flex flex-col items-center justify-center gap-2 w-full h-full hover:bg-border/20 transition-colors"
						title="Open PDF"
					>
						<FileText aria-hidden="true" className="w-10 h-10 text-danger/70" />
						<span className="text-[10px] text-text-faint">Open PDF</span>
					</a>
				) : isPdf ? (
					<div className="flex flex-col items-center justify-center gap-1">
						<FileText aria-hidden="true" className="w-8 h-8 text-danger/70" />
						<span className="text-[10px] text-text-faint">PDF</span>
					</div>
				) : (
					<div className="p-3 text-center">
						<FileText
							aria-hidden="true"
							className="w-8 h-8 mx-auto mb-1 text-text-faint"
						/>
						<p className="text-[10px] font-mono text-text-muted truncate">
							{asset.mimeType.split("/")[1]}
						</p>
					</div>
				)}
			</div>

			{deleteAction ? <DeleteMediaButton deleteAction={deleteAction} /> : null}

			<div className="p-2">
				<p
					className="text-xs font-medium text-text truncate"
					title={asset.filename}
				>
					{asset.filename}
				</p>
				<p className="text-[10px] text-text-faint mt-0.5">
					{formatBytes(asset.size)}
				</p>
			</div>
		</div>
	);

	return href ? (
		<a href={href} className="block">
			{card}
		</a>
	) : (
		card
	);
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
