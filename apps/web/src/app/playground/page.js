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
	ThemeProvider,
	Toast,
	useToast,
} from "@techstream/quark-ui";
import { useState } from "react";
import { Sidebar } from "./_components/Sidebar";

const TABLE_DATA = [
	{ name: "Alice", role: "Admin", status: "Active" },
	{ name: "Bob", role: "Viewer", status: "Inactive" },
];

function Group({ label, children }) {
	return (
		<div className="space-y-2.5">
			<p className="font-mono uppercase text-[11px] tracking-[0.2em] text-text-muted">
				{label}
			</p>
			<div className="flex flex-wrap items-center gap-2">{children}</div>
		</div>
	);
}

function ComponentSection({ id, index, title, children }) {
	const num = String(index).padStart(2, "0");
	return (
		<section
			id={id}
			className="scroll-mt-8 space-y-5 py-5 border-t border-border"
		>
			<h2 className="font-mono uppercase text-xs tracking-[0.2em] text-text-faint">
				§ {num} — {title}
			</h2>
			{children}
		</section>
	);
}

export default function PlaygroundPage() {
	return (
		<ThemeProvider defaultTheme="dark">
			<PlaygroundInner />
		</ThemeProvider>
	);
}

function PlaygroundInner() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const toast = useToast();

	return (
		<div className="min-h-screen bg-bg dark:bg-zinc-950 transition-colors duration-200 lg:pl-56">
			<Sidebar />

			<main className="min-h-screen">
				<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-12 py-10">
					{/* Page label */}
					<p className="font-mono uppercase mb-6 text-xs tracking-[0.15em] text-text-faint">
						quark-ui · component reference
					</p>

					<div className="space-y-2">
						{/* ── 01 Button ── */}
						<ComponentSection id="button" index={1} title="Button">
							<Group label="variant">
								<Button variant="primary">Primary</Button>
								<Button variant="secondary">Secondary</Button>
								<Button variant="danger">Danger</Button>
								<Button variant="ghost">Ghost</Button>
							</Group>
							<Group label="themed">
								<Button variant="success">Success</Button>
								<Button variant="warning">Warning</Button>
								<Button variant="info">Info</Button>
								<Button variant="outline">Outline</Button>
								<Button variant="solid">Solid</Button>
							</Group>
							<Group label="size">
								<Button>Small</Button>
								<Button size="md">Medium</Button>
								<Button size="lg">Large</Button>
							</Group>
							<Group label="state">
								<Button disabled>Disabled</Button>
							</Group>
						</ComponentSection>

						{/* ── 02 Badge ── */}
						<ComponentSection id="badge" index={2} title="Badge">
							<Group label="variant">
								<Badge>Default</Badge>
								<Badge variant="success">Success</Badge>
								<Badge variant="warning">Warning</Badge>
								<Badge variant="danger">Danger</Badge>
								<Badge variant="info">Info</Badge>
							</Group>
						</ComponentSection>

						{/* ── 03 Form ── */}
						<ComponentSection id="form" index={3} title="Form Controls">
							<div className="max-w-xs space-y-3">
								<div>
									<Label htmlFor="inp">Input</Label>
									<Input id="inp" placeholder="Enter text…" />
								</div>
								<div>
									<Label htmlFor="ta">Textarea</Label>
									<Textarea id="ta" placeholder="Enter text…" rows={3} />
								</div>
								<div>
									<Label htmlFor="sel">Select</Label>
									<Select id="sel">
										<option value="">Choose…</option>
										<option value="a">Option A</option>
										<option value="b">Option B</option>
									</Select>
								</div>
								<Checkbox id="chk" label="Accept terms" />
							</div>
						</ComponentSection>

						{/* ── 04 Card ── */}
						<ComponentSection id="card" index={4} title="Card">
							<Card className="max-w-xs bg-surface shadow-sm">
								<CardHeader>
									<CardTitle>Card Title</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-text-muted">
										Card body content goes here.
									</p>
								</CardContent>
								<CardFooter>
									<Button>Action</Button>
								</CardFooter>
							</Card>
						</ComponentSection>

						{/* ── 05 Table ── */}
						<ComponentSection id="table" index={5} title="Table">
							<div className="bg-surface overflow-hidden rounded-md border border-border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Name</TableHead>
											<TableHead>Role</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{TABLE_DATA.map((r) => (
											<TableRow key={r.name}>
												<TableCell>{r.name}</TableCell>
												<TableCell>{r.role}</TableCell>
												<TableCell>
													<Badge
														variant={
															r.status === "Active" ? "success" : "default"
														}
													>
														{r.status}
													</Badge>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</ComponentSection>

						{/* ── 06 Skeleton ── */}
						<ComponentSection id="skeleton" index={6} title="Skeleton">
							<div className="space-y-3 max-w-xs">
								<Skeleton className="h-4 w-40" />
								<div className="flex items-center gap-3">
									<Skeleton className="h-9 w-9 rounded-full" />
									<div className="space-y-1.5 flex-1">
										<Skeleton className="h-3 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
									</div>
								</div>
								<Skeleton className="h-20 w-full" />
							</div>
						</ComponentSection>

						{/* ── 07 Dialog ── */}
						<ComponentSection id="dialog" index={7} title="Dialog">
							<Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
							<Dialog
								open={dialogOpen}
								onClose={() => setDialogOpen(false)}
								title="Confirm Action"
							>
								<p className="text-sm text-text-muted">
									Are you sure you want to continue? This action cannot be
									undone.
								</p>
								<div className="mt-5 flex justify-end gap-2">
									<Button onClick={() => setDialogOpen(false)}>Confirm</Button>
									<Button
										variant="secondary"
										onClick={() => setDialogOpen(false)}
									>
										Cancel
									</Button>
								</div>
							</Dialog>
						</ComponentSection>

						{/* ── 08 Toast ── */}
						<ComponentSection id="toast" index={8} title="Toast">
							<Group label="trigger">
								<Button onClick={() => toast.show("Changes saved.", "success")}>
									Success
								</Button>
								<Button
									variant="danger"
									onClick={() => toast.show("Request failed.", "error")}
								>
									Error
								</Button>
								<Button
									variant="secondary"
									onClick={() => toast.show("Notification sent.")}
								>
									Default
								</Button>
							</Group>
							<Toast {...toast.toastProps} />
						</ComponentSection>
					</div>
				</div>
			</main>
		</div>
	);
}
