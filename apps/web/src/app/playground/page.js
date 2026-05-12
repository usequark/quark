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
	Footer,
	Input,
	Label,
	MobileNavbar,
	Navbar,
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
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "./_components/Sidebar";

const TABLE_DATA = [
	{ name: "Alice", role: "Admin", status: "Active" },
	{ name: "Bob", role: "Viewer", status: "Inactive" },
];

const NAV_LINKS = [
	{ label: "Home", href: "#" },
	{
		label: "Services",
		items: [
			{ label: "Web Development", href: "#" },
			{ label: "Design Systems", href: "#" },
			{ label: "Consulting", href: "#" },
		],
	},
	{ label: "Pricing", href: "#" },
	{
		label: "Company",
		items: [
			{ label: "About", href: "#" },
			{ label: "Careers", href: "#" },
			{ label: "Contact", href: "#" },
		],
	},
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
	const [previewType, setPreviewType] = useState(null);
	const [sortState, setSortState] = useState({ key: "name", direction: "asc" });
	const toast = useToast();

	useEffect(() => {
		if (!previewType) return;

		function onEscape(event) {
			if (event.key === "Escape") {
				setPreviewType(null);
			}
		}

		document.addEventListener("keydown", onEscape);
		return () => document.removeEventListener("keydown", onEscape);
	}, [previewType]);

	useEffect(() => {
		if (!previewType) return;

		const previousBodyOverflow = document.body.style.overflow;
		const previousHtmlOverflow = document.documentElement.style.overflow;

		document.body.style.overflow = "hidden";
		document.documentElement.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = previousBodyOverflow;
			document.documentElement.style.overflow = previousHtmlOverflow;
		};
	}, [previewType]);

	const rows = useMemo(() => {
		const sorted = [...TABLE_DATA].sort((a, b) => {
			const left = String(a[sortState.key] ?? "").toLowerCase();
			const right = String(b[sortState.key] ?? "").toLowerCase();
			if (left === right) return 0;
			return left > right ? 1 : -1;
		});

		if (sortState.direction === "desc") sorted.reverse();
		return sorted;
	}, [sortState]);

	function toggleSort(columnKey) {
		setSortState((state) => {
			if (state.key !== columnKey) {
				return { key: columnKey, direction: "asc" };
			}

			return {
				key: columnKey,
				direction: state.direction === "asc" ? "desc" : "asc",
			};
		});
	}

	function getSortDirection(columnKey) {
		return sortState.key === columnKey ? sortState.direction : "none";
	}

	const previewTitle =
		previewType === "desktop-navbar"
			? "Desktop Navbar Preview"
			: previewType === "mobile-navbar"
				? "Mobile Navbar Preview"
				: "Footer Preview";

	function renderPreviewBody() {
		if (previewType === "desktop-navbar") {
			return (
				<div className="p-4 sm:p-6">
					<div className="overflow-hidden rounded-[--radius-default] border border-border bg-bg">
						<Navbar
							logo="Quark Studio"
							links={NAV_LINKS}
							action={{ label: "Login", href: "#" }}
							maxWidthClassName="max-w-5xl"
						/>
						<div className="h-48 border-t border-border bg-[radial-gradient(circle_at_top,rgba(120,160,255,0.08),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] px-4 py-6 sm:px-6">
							<p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
								Desktop Canvas
							</p>
							<h3 className="mt-3 text-lg font-semibold text-text">
								Centered navigation with dropdown support and right-side CTA.
							</h3>
							<p className="mt-2 max-w-2xl text-sm text-text-muted">
								The navigation row is constrained with a max width so it does
								not stretch edge to edge.
							</p>
						</div>
					</div>
				</div>
			);
		}

		if (previewType === "mobile-navbar") {
			return (
				<div className="flex justify-center p-4 sm:p-6">
					<div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-bg shadow-[0_10px_50px_rgba(0,0,0,0.25)]">
						<MobileNavbar
							logo="Quark Studio"
							links={NAV_LINKS}
							action={{ label: "Contact", href: "#" }}
							maxWidthClassName="max-w-full"
						/>
						<div className="h-64 border-t border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] px-4 py-5">
							<p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
								Mobile Canvas
							</p>
							<p className="mt-3 text-sm text-text-muted">
								Tap the burger icon, then expand a parent item to reveal
								animated submenu links.
							</p>
						</div>
					</div>
				</div>
			);
		}

		return <Footer />;
	}

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
								<Button size="sm">Small</Button>
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
								<Badge variant="primary">Primary</Badge>
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
							<div className="grid gap-3 md:grid-cols-2">
								<Card className="max-w-xs bg-surface shadow-sm">
									<CardHeader>
										<CardTitle>Default Card</CardTitle>
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

								<Card
									variant="collapsible"
									collapsibleLabel="Collapsible Card"
									className="max-w-xs bg-surface shadow-sm"
								>
									<p className="text-sm">
										This card variant can collapse and expand its body content.
									</p>
								</Card>
							</div>
						</ComponentSection>

						{/* ── 05 Table ── */}
						<ComponentSection id="table" index={5} title="Table">
							<div className="bg-surface overflow-hidden rounded-md border border-border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead
												sortable
												sortDirection={getSortDirection("name")}
												onSort={() => toggleSort("name")}
											>
												Name
											</TableHead>
											<TableHead
												sortable
												sortDirection={getSortDirection("role")}
												onSort={() => toggleSort("role")}
											>
												Role
											</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{rows.map((r) => (
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
								<Button
									variant="success"
									onClick={() => toast.show("Changes saved.", "success")}
								>
									Success
								</Button>
								<Button
									variant="danger"
									onClick={() => toast.show("Request failed.", "error")}
								>
									Error
								</Button>
								<Button onClick={() => toast.show("Notification sent.")}>
									Default
								</Button>
							</Group>
							<Toast {...toast.toastProps} />
						</ComponentSection>

						{/* ── 09 Footer ── */}
						<ComponentSection id="footer" index={9} title="Footer">
							<Group label="preview">
								<Button
									variant="secondary"
									onClick={() => setPreviewType("desktop-navbar")}
								>
									Desktop Navbar Preview
								</Button>
								<Button
									variant="secondary"
									onClick={() => setPreviewType("mobile-navbar")}
								>
									Mobile Navbar Preview
								</Button>
								<Button
									variant="secondary"
									onClick={() => setPreviewType("footer")}
								>
									Footer Preview
								</Button>
							</Group>
						</ComponentSection>
					</div>
				</div>
			</main>

			{previewType ? (
				<div className="fixed inset-0 z-60" role="dialog" aria-modal="true">
					<button
						type="button"
						aria-label="Close preview"
						onClick={() => setPreviewType(null)}
						className="absolute inset-0 bg-black/60"
					/>

					<div className="absolute inset-x-0 bottom-0 mx-0 flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden border-y border-border bg-surface shadow-2xl">
						<div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
							<p className="font-mono uppercase text-[11px] tracking-[0.2em] text-text-faint">
								{previewTitle}
							</p>
							<Button
								size="sm"
								variant="secondary"
								onClick={() => setPreviewType(null)}
							>
								Close
							</Button>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
							{renderPreviewBody()}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
