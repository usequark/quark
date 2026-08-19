import {
	adminConfig,
	countRecords,
	getModels,
	modelToSlug,
} from "@techstream/quark-admin";
import { prisma } from "@techstream/quark-db";
import MetricCard from "./_patterns/Dashboard";
import { getServiceHealth } from "./_lib/dashboard-data";

export default async function AdminDashboard() {
	const models = getModels();

	const [counts, health] = await Promise.all([
		Promise.allSettled(
			models.map(async (model) => ({
				name: model.name,
				slug: modelToSlug(model.name),
				count: await countRecords(prisma, model.name),
			})),
		),
		getServiceHealth(),
	]);

	const rows = counts
		.filter((r) => r.status === "fulfilled")
		.map((r) => r.value)
		.filter(({ name }) => !adminConfig.modelOverrides[name]?.readOnly);

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
				<p className="mt-1 text-sm text-gray-500">
					Decision-relevant values across your application.
				</p>
			</div>

			{/* ── Service Status ── */}
			<section>
				<h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
					Service Status
				</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<MetricCard
						label="PostgreSQL"
						value={health.database.status === "ok" ? "Connected" : "Error"}
						hint={
							health.database.status === "ok"
								? `${health.database.latencyMs}ms latency`
								: health.database.message
						}
					/>
					<MetricCard
						label="Redis"
						value={health.redis.status === "ok" ? "Connected" : "Error"}
						hint={
							health.redis.status === "ok"
								? `${health.redis.latencyMs}ms latency`
								: health.redis.message
						}
					/>
				</div>
			</section>

			{/* ── Data Models ── */}
			<section>
				<h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
					Data Models
				</h2>
				{rows.length === 0 ? (
					<div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
						<p className="text-sm font-medium text-gray-600">No models found</p>
						<p className="mt-1 text-xs text-gray-400">
							Add models to your Prisma schema and run{" "}
							<code className="font-mono">pnpm db:migrate</code>
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{rows.map(({ name, slug, count }) => (
							<MetricCard
								key={name}
								label={name}
								value={count}
								hint="records"
								href={`/admin/${slug}`}
							/>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
