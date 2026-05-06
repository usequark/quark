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
					{assets.map((asset) => (
						<div
							key={asset.id}
							className="group rounded-[--radius-default] border border-border bg-surface overflow-hidden"
						>
							{/* Preview */}
							<div className="relative aspect-square bg-surface-hover flex items-center justify-center overflow-hidden">
								{asset.mimeType.startsWith("image/") ? (
									<Image
										fill
										src={`/api/media/${encodeURIComponent(asset.storageKey)}`}
										alt={asset.alt ?? asset.filename}
										className="object-cover"
										sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
									/>
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
								<p className="text-[10px] text-text-faint mt-0.5">
									{formatBytes(asset.size)}
								</p>
								<DeleteMediaButton
									action={cmsDeleteMedia.bind(null, asset.id)}
								/>
							</div>
						</div>
					))}
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
