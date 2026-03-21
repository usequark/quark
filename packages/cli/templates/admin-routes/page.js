import { countRecords, getModels, modelToSlug } from "@techstream/quark-admin";
import { prisma } from "@techstream/quark-db";
import { Card, CardContent, CardHeader, CardTitle } from "@techstream/quark-ui";

export default async function AdminDashboard() {
	const models = getModels();

	// Count records for all models in parallel — ignore errors for models we can't count
	const counts = await Promise.allSettled(
		models.map(async (model) => ({
			name: model.name,
			slug: modelToSlug(model.name),
			count: await countRecords(prisma, model.name),
		})),
	);

	const rows = counts
		.filter((r) => r.status === "fulfilled")
		.map((r) => r.value);

	return (
		<div>
			<h1 className="text-2xl font-bold mb-6">Dashboard</h1>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{rows.map(({ name, slug, count }) => (
					<a key={name} href={`/admin/${slug}`} className="block group">
						<Card className="hover:border-gray-400 transition-colors">
							<CardHeader className="pb-2">
								<CardTitle className="text-base font-medium text-gray-600 group-hover:text-gray-900">
									{name}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-3xl font-bold tabular-nums">{count}</p>
								<p className="text-sm text-gray-400 mt-1">records</p>
							</CardContent>
						</Card>
					</a>
				))}
			</div>
		</div>
	);
}
