import {
	Button,
	Card,
	CardContent,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@techstream/quark-ui";
import StatusBadge from "./StatusBadge";

/**
 * @param {{
 *   records: object[],
 *   modelSlug: string,  // "pages" | "posts"
 *   basePath: string    // "/admin/cms/pages"
 * }} props
 */
export default function ContentTable({ records, basePath }) {
	if (records.length === 0) {
		return (
			<Card>
				<CardContent className="pt-14! pb-14 text-center flex flex-col items-center justify-center">
					<p className="mb-2 text-sm font-medium text-text">No content yet</p>
					<p className="mb-4 text-xs text-text-faint">
						Create your first entry to start building this section.
					</p>
					<a href={`${basePath}/new`}>
						<Button variant="secondary">Create your first entry</Button>
					</a>
				</CardContent>
			</Card>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Title</TableHead>
					<TableHead className="w-[120px]">Slug</TableHead>
					<TableHead className="w-[120px]">Status</TableHead>
					<TableHead className="w-[160px]">Updated</TableHead>
					<TableHead className="w-[70px] text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{records.map((record) => (
					<TableRow key={record.id}>
						<TableCell className="font-medium text-text">
							{record.title}
							{record.excerpt && (
								<p className="text-xs text-text-faint mt-0.5 truncate max-w-[320px]">
									{record.excerpt}
								</p>
							)}
						</TableCell>
						<TableCell className="font-mono text-xs text-text-muted">
							/{record.slug}
						</TableCell>
						<TableCell>
							<StatusBadge status={record.status} />
						</TableCell>
						<TableCell className="text-xs text-text-muted tabular-nums">
							{new Date(record.updatedAt).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</TableCell>
						<TableCell className="text-right">
							<a
								href={`${basePath}/${record.id}`}
								className="text-sm text-primary hover:opacity-75"
							>
								Edit
							</a>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
