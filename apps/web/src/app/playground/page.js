"use client";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
	Checkbox,
	Dialog,
	Input,
	Label,
	Select,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Textarea,
	Toast,
	useToast,
} from "@techstream/quark-ui";
/**
 * UI Component Playground — monorepo reference implementation.
 * Shows every exported component from @techstream/quark-ui.
 *
 * In a scaffolded project (if ui was selected), this lives at
 * apps/web/src/app/playground/page.js and imports from @yourscope/ui.
 */
import Link from "next/link";
import { useState } from "react";

function Section({ title, children }) {
	return (
		<section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
			<h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
				{title}
			</h2>
			<div className="space-y-3">{children}</div>
		</section>
	);
}

function Row({ label, children }) {
	return (
		<div className="flex flex-wrap items-center gap-3">
			<span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500">
				{label}
			</span>
			{children}
		</div>
	);
}

export default function PlaygroundPage() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const { show, toastProps } = useToast();

	return (
		<main className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6 sm:p-8">
			<div className="mx-auto max-w-4xl space-y-8">
				<div>
					<Link
						href="/"
						className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
					>
						&#8592; Home
					</Link>
					<h1 className="text-3xl font-bold text-gray-900">UI Playground</h1>
					<p className="mt-2 text-gray-600">
						All components from{" "}
						<code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
							@techstream/quark-ui
						</code>
					</p>
				</div>

				{/* Buttons */}
				<Section title="Button">
					<Row label="variant">
						<Button variant="primary">Primary</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="danger">Danger</Button>
						<Button variant="ghost">Ghost</Button>
					</Row>
					<Row label="size">
						<Button size="sm">Small</Button>
						<Button size="md">Medium</Button>
						<Button size="lg">Large</Button>
					</Row>
					<Row label="disabled">
						<Button disabled>Disabled</Button>
					</Row>
				</Section>

				{/* Badges */}
				<Section title="Badge">
					<Row label="variant">
						<Badge>Default</Badge>
						<Badge variant="success">Success</Badge>
						<Badge variant="warning">Warning</Badge>
						<Badge variant="danger">Danger</Badge>
						<Badge variant="info">Info</Badge>
					</Row>
				</Section>

				{/* Form controls */}
				<Section title="Form Controls">
					<div className="max-w-sm space-y-3">
						<div>
							<Label htmlFor="sample-input">Input</Label>
							<Input id="sample-input" placeholder="Enter text..." />
						</div>
						<div>
							<Label htmlFor="sample-textarea">Textarea</Label>
							<Textarea
								id="sample-textarea"
								placeholder="Enter longer text..."
								rows={3}
							/>
						</div>
						<div>
							<Label htmlFor="sample-select">Select</Label>
							<Select id="sample-select">
								<option value="">Choose an option</option>
								<option value="a">Option A</option>
								<option value="b">Option B</option>
							</Select>
						</div>
						<Checkbox id="sample-checkbox" label="Check me" />
					</div>
				</Section>

				{/* Card */}
				<Section title="Card">
					<Card className="max-w-sm">
						<CardHeader>
							<CardTitle>Card Title</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-gray-600">
								Card body content goes here.
							</p>
						</CardContent>
						<CardFooter>
							<Button size="sm">Action</Button>
						</CardFooter>
					</Card>
				</Section>

				{/* Table */}
				<Section title="Table">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{[
								{ name: "Alice", role: "Admin", status: "Active" },
								{ name: "Bob", role: "Viewer", status: "Inactive" },
							].map((row) => (
								<TableRow key={row.name}>
									<TableCell>{row.name}</TableCell>
									<TableCell>{row.role}</TableCell>
									<TableCell>
										<Badge
											variant={row.status === "Active" ? "success" : "default"}
										>
											{row.status}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Section>

				{/* Skeleton */}
				<Section title="Skeleton">
					<Row label="shapes">
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-8 w-8 rounded-full" />
						<Skeleton className="h-16 w-32" />
					</Row>
				</Section>

				{/* Dialog */}
				<Section title="Dialog">
					<Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
					<Dialog
						open={dialogOpen}
						onClose={() => setDialogOpen(false)}
						title="Example Dialog"
					>
						<p className="text-sm text-gray-600">
							This is a native dialog element.
						</p>
						<div className="mt-4 flex justify-end">
							<Button size="sm" onClick={() => setDialogOpen(false)}>
								Close
							</Button>
						</div>
					</Dialog>
				</Section>

				{/* Toast */}
				<Section title="Toast">
					<Row label="trigger">
						<Button onClick={() => show("Saved successfully!", "success")}>
							Success toast
						</Button>
						<Button
							variant="danger"
							onClick={() => show("Something went wrong.", "error")}
						>
							Error toast
						</Button>
						<Button
							variant="secondary"
							onClick={() => show("Hello from toast.")}
						>
							Default toast
						</Button>
					</Row>
					<Toast {...toastProps} />
				</Section>
			</div>
		</main>
	);
}
