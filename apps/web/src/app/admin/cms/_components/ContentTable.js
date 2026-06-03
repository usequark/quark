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
 *   modelSlug: string,
 *   basePath: string
 * }} props
 */
export default function ContentTable({ records, basePath }) {
	if (records.length === 0) {
		return (
			<Card>
				<CardContent className="pt-14! pb-14 text-center flex flex-col items-center justify-center">
					<div className="mb-3 flex h-12 w-12 items-center justify-center border border-border bg-surface-hover">
						<svg
							aria-hidden="true"
							className="h-5 w-5 text-text-faint"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
					</div>
					<p className="mb-1 text-sm font-medium text-text">No content yet</p>
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
		<div className="border border-border bg-surface">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Title</TableHead>
						<TableHead className="w-[140px]">Status</TableHead>
						<TableHead className="w-[150px]">Updated</TableHead>
						<TableHead className="w-[80px] text-right">Edit</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{records.map((record) => (
						<TableRow key={record.id}>
							<TableCell className="font-medium text-text">
								<a
									href={`${basePath}/${record.id}`}
									className="hover:text-primary transition-colors"
								>
									{record.title}
								</a>
								{record.excerpt && (
									<p className="text-xs text-text-faint mt-0.5 truncate max-w-[320px]">
										{record.excerpt}
									</p>
								)}
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
									className="inline-flex items-center gap-1 border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:border-border-hover hover:text-text transition-colors"
								>
									Edit
								</a>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
