import { prisma } from "@techstream/quark-db";
import { Button, Card, CardContent } from "@techstream/quark-ui";
import Link from "next/link";
import AdminActionToast from "../../_components/AdminActionToast";
import MediaAssetCard from "../_components/MediaAssetCard";

export const metadata = { title: "Media Library" };

export default async function MediaPage({ searchParams }) {
	const { toast } = await searchParams;
	const [assets, total] = await Promise.all([
		prisma.mediaAsset.findMany({
			orderBy: { createdAt: "desc" },
			take: 100,
		}),
		prisma.mediaAsset.count(),
	]);

	return (
		<div>
			<AdminActionToast
				toastKey={toast}
				resourceLabel="Media"
				messageOverrides={{ uploaded: "{resource} uploaded." }}
			/>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-text">Media Library</h1>
					<p className="text-sm text-text-faint mt-1">
						{total} asset{total !== 1 ? "s" : ""}
					</p>
				</div>
				<Link href="/admin/cms/media/upload">
					<Button>Upload</Button>
				</Link>
			</div>

			{assets.length === 0 ? (
				<Card>
					<CardContent className="pt-16! pb-16 text-center flex flex-col items-center justify-center">
						<p className="mb-2 text-sm font-medium text-text">
							No media uploaded yet
						</p>
						<p className="mb-4 text-xs text-text-faint">
							Upload your first asset to build a reusable media library.
						</p>
						<Link href="/admin/cms/media/upload">
							<Button variant="secondary">Upload your first file</Button>
						</Link>
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
					{assets.map((asset) => {
						return (
							<MediaAssetCard
								key={asset.id}
								asset={asset}
								href={`/admin/cms/media/edit/${asset.id}`}
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
