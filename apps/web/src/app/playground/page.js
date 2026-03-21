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
	ThemeToggle,
	Toast,
	useToast,
} from "@techstream/quark-ui";
import Link from "next/link";
import { useEffect, useState } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const TABLE_DATA = [
	{ name: "Alice", role: "Admin", status: "Active" },
	{ name: "Bob", role: "Viewer", status: "Inactive" },
];

const SECTIONS = [
	{ id: "button", label: "Button" },
	{ id: "badge", label: "Badge" },
	{ id: "form", label: "Form" },
	{ id: "card", label: "Card" },
	{ id: "table", label: "Table" },
	{ id: "skeleton", label: "Skeleton" },
	{ id: "dialog", label: "Dialog" },
	{ id: "toast", label: "Toast" },
];

// ── Layout helpers ────────────────────────────────────────────────────────────

function Group({ label, children }) {
	return (
		<div className="space-y-2.5">
			<p className="font-mono uppercase text-[11px] tracking-[0.2em] text-[#9ca3af] dark:text-[#4a6080]">
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
			className="scroll-mt-6 space-y-5 py-5 border-t border-black/18 dark:border-white/25"
		>
			<h2 className="font-mono uppercase text-xs tracking-[0.2em] text-[#9ca3af] dark:text-[#5c5c72]">
				§ {num} — {title}
			</h2>
			{children}
		</section>
	);
}

function NavItem({ id, label, index }) {
	const num = String(index).padStart(2, "0");
	return (
		<a
			href={`#${id}`}
			className="block font-mono uppercase text-[13px] tracking-[0.15em] text-[#9ca3af] dark:text-[#7c8fa0] hover:text-[#2563eb] dark:hover:text-[#377dff] transition-colors py-[3px]"
			style={{ textDecoration: "none" }}
		>
			{num} · {label}
		</a>
	);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
	return (
		<ThemeProvider defaultTheme="dark">
			<PlaygroundInner />
		</ThemeProvider>
	);
}

function PlaygroundInner() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	const [dialogOpen, setDialogOpen] = useState(false);
	const toast = useToast();

	// Return a static placeholder before mount so the server-rendered HTML and
	// the client's first render are identical — no hydration mismatch.
	// After mount, the lazy ThemeProvider already has the correct stored theme,
	// so the full page renders immediately in the right theme with no flash.
	if (!mounted) {
		return (
			<div className="min-h-screen" style={{ backgroundColor: "#05070a" }} />
		);
	}

	return (
		<main
			className="min-h-screen bg-[#f7f8fa] dark:bg-[#05070a] transition-colors duration-200"
			style={{
				backgroundImage:
					"linear-gradient(var(--quark-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--quark-grid-line) 1px, transparent 1px)",
				backgroundSize: "40px 40px",
			}}
		>
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
				{/* Body: sticky left nav + content */}
				<div className="flex gap-12">
					{/* Left nav */}
					<nav className="hidden lg:block w-32 shrink-0">
						<div className="sticky top-8">
							<div className="flex items-center justify-between mb-4">
								<Link
									href="/"
									className="quark-home-link text-[13px] font-mono"
								>
									← home
								</Link>
								<ThemeToggle />
							</div>
							<p className="font-mono uppercase mb-3 text-[13px] tracking-[0.2em] text-[#9ca3af] dark:text-[#7c8fa0]">
								index
							</p>
							{SECTIONS.map((s, i) => (
								<NavItem key={s.id} id={s.id} label={s.label} index={i + 1} />
							))}
						</div>
					</nav>

					{/* Main content */}
					<div className="flex-1 min-w-0">
						{/* Page label */}
						<p className="font-mono uppercase mb-2 text-xs tracking-[0.15em] text-[#9ca3af] dark:text-[#5c5c72]">
							quark-ui · component reference
						</p>

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
							<Card className="max-w-xs">
								<CardHeader>
									<CardTitle>Card Title</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-[#6b7280] dark:text-[#6b7a99]">
										Card body content goes here.
									</p>
								</CardContent>
								<CardFooter>
									<Button size="sm">Action</Button>
								</CardFooter>
							</Card>
						</ComponentSection>

						{/* ── 05 Table ── */}
						<ComponentSection id="table" index={5} title="Table">
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
								<p className="text-sm text-[#6b7280] dark:text-[#6b7a99]">
									Are you sure you want to continue? This action cannot be
									undone.
								</p>
								<div className="mt-5 flex justify-end gap-2">
									<Button
										variant="secondary"
										size="sm"
										onClick={() => setDialogOpen(false)}
									>
										Cancel
									</Button>
									<Button size="sm" onClick={() => setDialogOpen(false)}>
										Confirm
									</Button>
								</div>
							</Dialog>
						</ComponentSection>

						{/* ── 08 Toast ── */}
						<ComponentSection id="toast" index={8} title="Toast">
							<Group label="trigger">
								<Button
									size="sm"
									onClick={() => toast.show("Changes saved.", "success")}
								>
									Success
								</Button>
								<Button
									size="sm"
									variant="danger"
									onClick={() => toast.show("Request failed.", "error")}
								>
									Error
								</Button>
								<Button
									size="sm"
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
			</div>
		</main>
	);
}
