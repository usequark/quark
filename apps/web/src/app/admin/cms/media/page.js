import { prisma } from "@techstream/quark-db";
import { Button } from "@techstream/quark-ui";
import { cmsDeleteMedia } from "../_actions/media";
import MediaAssetCard from "../_components/MediaAssetCard";

export const metadata = { title: "Media Library" };

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
						return (
							<MediaAssetCard
								key={asset.id}
								asset={asset}
								deleteAction={cmsDeleteMedia.bind(null, asset.id)}
							/>
						);
					})}
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
