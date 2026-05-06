import { prisma } from "@techstream/quark-db";
import { Button } from "@techstream/quark-ui";
import Image from "next/image";
import { cmsDeleteMedia } from "../_actions/media";
import DeleteMediaButton from "../_components/DeleteMediaButton";

export const metadata = { title: "Media Library" };

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MediaPage() {
	const [assets, total] = await Promise.all([
		prisma.mediaAsset.findMany({
			orderBy: { createdAt: "desc" },
			take: 100,
		}),
		prisma.mediaAsset.count(),
	]);

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-text">Media Library</h1>
					<p className="text-sm text-text-faint mt-1">
						{total} asset{total !== 1 ? "s" : ""}
					</p>
				</div>
				<a href="/admin/cms/media/upload">
					<Button>Upload</Button>
				</a>
			</div>

			{assets.length === 0 ? (
				<div className="rounded-[--radius-default] border border-border py-20 text-center">
					<p className="text-sm text-text-faint mb-3">No media uploaded yet</p>
					<a href="/admin/cms/media/upload">
						<Button variant="secondary">Upload your first file</Button>
					</a>
				</div>
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
					{assets.map((asset) => {
						const isPdf = asset.mimeType === "application/pdf";
						const isImage = asset.mimeType.startsWith("image/");
						const assetUrl = `/api/media/${encodeURIComponent(asset.storageKey)}`;

						return (
						<div
							key={asset.id}
							className="group rounded-[--radius-default] border border-border bg-surface overflow-hidden"
						>
							{/* Preview */}
							<div className="relative aspect-square bg-surface-hover flex items-center justify-center overflow-hidden">
								{isImage ? (
									<Image
										fill
										src={assetUrl}
										alt={asset.alt ?? asset.filename}
										className="object-cover"
										sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
									/>
								) : isPdf ? (
									<a
										href={assetUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="flex flex-col items-center justify-center gap-2 w-full h-full hover:bg-border/20 transition-colors"
										title="Open PDF"
									>
										<svg
											aria-hidden="true"
											className="w-10 h-10 text-danger/70"
											fill="currentColor"
											viewBox="0 0 24 24"
										>
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
											<path fill="white" fillOpacity=".9" d="M14 2v6h6" />
											<path
												fill="white"
												fillOpacity=".95"
												d="M9 13h1.5c.83 0 1.5.67 1.5 1.5S11.33 16 10.5 16H9v1.5H8V13h1zm1.5 2c.28 0 .5-.22.5-.5s-.22-.5-.5-.5H9v1h1.5zM13 13h1.5c1.1 0 2 .9 2 2s-.9 2-2 2H13v-4zm1.5 3c.55 0 1-.45 1-1s-.45-1-1-1H14v2h.5zM17 13h2v1h-2v1h2v1h-2v1.5h-1V13h1z"
											/>
										</svg>
										<span className="text-[10px] text-text-faint">Open PDF</span>
									</a>
								) : (
									<div className="p-3 text-center">
										<p className="text-2xl mb-1">📄</p>
										<p className="text-[10px] font-mono text-text-muted truncate">
											{asset.mimeType.split("/")[1]}
										</p>
									</div>
								)}
							</div>

							{/* Metadata */}
							<div className="p-2">
								<p
									className="text-xs font-medium text-text truncate"
									title={asset.filename}
								>
									{asset.filename}
								</p>
								<div className="flex items-center justify-between mt-0.5">
									<p className="text-[10px] text-text-faint">
										{formatBytes(asset.size)}
									</p>
									{isPdf && (
										<a
											href={assetUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="text-[10px] text-primary hover:opacity-75 transition-opacity"
										>
											Preview ↗
										</a>
									)}
								</div>
								<DeleteMediaButton
									action={cmsDeleteMedia.bind(null, asset.id)}
								/>
							</div>
						</div>
					)})}
				</div>
			)}
			{total > 100 && (
				<p className="mt-3 text-xs text-text-faint text-center tabular-nums">
					Showing 100 of {total} assets.
				</p>
			)}
		</div>
	);
}
