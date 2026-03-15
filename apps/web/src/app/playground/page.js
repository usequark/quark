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
	useTheme,
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

function Group({ label, theme, children }) {
	return (
		<div className="space-y-2.5">
			<p
				className="font-mono uppercase"
				style={{
					fontSize: "9px",
					letterSpacing: "0.2em",
					color: theme === "dark" ? "#2a3550" : "#c0cad8",
				}}
			>
				{label}
			</p>
			<div className="flex flex-wrap items-center gap-2">{children}</div>
		</div>
	);
}

function ComponentSection({ id, index, title, theme, children }) {
	const num = String(index).padStart(2, "0");
	return (
		<section
			id={id}
			className="scroll-mt-16 space-y-5 py-5"
			style={{
				borderTop: `0.5px solid ${theme === "dark" ? "#0d1120" : "#e5e7eb"}`,
			}}
		>
			<h2
				className="font-mono uppercase"
				style={{
					fontSize: "10px",
					letterSpacing: "0.2em",
					color: theme === "dark" ? "#3a3a4a" : "#9ca3af",
				}}
			>
				§ {num} — {title}
			</h2>
			{children}
		</section>
	);
}

function NavItem({ id, label, index, theme }) {
	const num = String(index).padStart(2, "0");
	const dimColor = theme === "dark" ? "#2a3550" : "#c0cad8";
	const activeColor = theme === "dark" ? "#377dff" : "#2563eb";
	return (
		<a
			href={`#${id}`}
			className="block font-mono uppercase"
			style={{
				fontSize: "9px",
				letterSpacing: "0.15em",
				color: dimColor,
				textDecoration: "none",
				transition: "color 0.15s linear",
				padding: "3px 0",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.color = activeColor;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.color = dimColor;
			}}
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

	const { theme } = useTheme();
	const isDark = theme === "dark";
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

	const bg = isDark ? "#05070a" : "#f7f8fa";
	const labelColor = isDark ? "#3a3a4a" : "#9ca3af";
	const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
	const gridBg = `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`;

	return (
		<main
			className="min-h-screen"
			style={{
				backgroundColor: bg,
				backgroundImage: gridBg,
				backgroundSize: "40px 40px",
				transition: "background-color 0.25s ease",
			}}
		>
			{/* Structural header strip */}
			<header
				className="sticky top-0 z-20"
				style={{
					borderBottom: `0.5px solid ${isDark ? "#0d1120" : "#e5e7eb"}`,
					background: isDark ? "rgba(5,7,10,0.88)" : "rgba(247,248,250,0.88)",
					backdropFilter: "blur(8px)",
					WebkitBackdropFilter: "blur(8px)",
				}}
			>
				<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
					<Link
						href="/"
						className="quark-home-link"
						style={{ fontSize: "11px", fontFamily: "monospace" }}
					>
						← home
					</Link>
					<ThemeToggle />
				</div>
			</header>

			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
				{/* Body: sticky left nav + content */}
				<div className="flex gap-12">
					{/* Left nav */}
					<nav className="hidden lg:block w-32 shrink-0">
						<div className="sticky top-16">
							<p
								className="font-mono uppercase mb-3"
								style={{
									fontSize: "8px",
									letterSpacing: "0.2em",
									color: isDark ? "#1a2035" : "#d1d5db",
								}}
							>
								index
							</p>
							{SECTIONS.map((s, i) => (
								<NavItem
									key={s.id}
									id={s.id}
									label={s.label}
									index={i + 1}
									theme={theme}
								/>
							))}
						</div>
					</nav>

					{/* Main content */}
					<div className="flex-1 min-w-0">
						{/* Page label */}
						<p
							className="font-mono uppercase mb-2"
							style={{
								color: labelColor,
								fontSize: "11px",
								letterSpacing: "0.15em",
							}}
						>
							quark-ui · component reference
						</p>

						{/* ── 01 Button ── */}
						<ComponentSection
							id="button"
							index={1}
							title="Button"
							theme={theme}
						>
							<Group label="variant" theme={theme}>
								<Button variant="primary" theme={theme}>
									Primary
								</Button>
								<Button variant="secondary" theme={theme}>
									Secondary
								</Button>
								<Button variant="danger" theme={theme}>
									Danger
								</Button>
								<Button variant="ghost" theme={theme}>
									Ghost
								</Button>
							</Group>
							<Group label="themed" theme={theme}>
								<Button variant="success" theme={theme}>
									Success
								</Button>
								<Button variant="warning" theme={theme}>
									Warning
								</Button>
								<Button variant="info" theme={theme}>
									Info
								</Button>
								<Button variant="outline" theme={theme}>
									Outline
								</Button>
								<Button variant="solid" theme={theme}>
									Solid
								</Button>
							</Group>
							<Group label="size" theme={theme}>
								<Button size="sm" theme={theme}>
									Small
								</Button>
								<Button size="md" theme={theme}>
									Medium
								</Button>
								<Button size="lg" theme={theme}>
									Large
								</Button>
							</Group>
							<Group label="state" theme={theme}>
								<Button disabled theme={theme}>
									Disabled
								</Button>
							</Group>
						</ComponentSection>

						{/* ── 02 Badge ── */}
						<ComponentSection id="badge" index={2} title="Badge" theme={theme}>
							<Group label="variant" theme={theme}>
								<Badge theme={theme}>Default</Badge>
								<Badge variant="success" theme={theme}>
									Success
								</Badge>
								<Badge variant="warning" theme={theme}>
									Warning
								</Badge>
								<Badge variant="danger" theme={theme}>
									Danger
								</Badge>
								<Badge variant="info" theme={theme}>
									Info
								</Badge>
							</Group>
						</ComponentSection>

						{/* ── 03 Form ── */}
						<ComponentSection
							id="form"
							index={3}
							title="Form Controls"
							theme={theme}
						>
							<div className="max-w-xs space-y-3">
								<div>
									<Label htmlFor="inp" theme={theme}>
										Input
									</Label>
									<Input id="inp" theme={theme} placeholder="Enter text…" />
								</div>
								<div>
									<Label htmlFor="ta" theme={theme}>
										Textarea
									</Label>
									<Textarea
										id="ta"
										theme={theme}
										placeholder="Enter text…"
										rows={3}
									/>
								</div>
								<div>
									<Label htmlFor="sel" theme={theme}>
										Select
									</Label>
									<Select id="sel" theme={theme}>
										<option value="">Choose…</option>
										<option value="a">Option A</option>
										<option value="b">Option B</option>
									</Select>
								</div>
								<Checkbox id="chk" label="Accept terms" theme={theme} />
							</div>
						</ComponentSection>

						{/* ── 04 Card ── */}
						<ComponentSection id="card" index={4} title="Card" theme={theme}>
							<Card theme={theme} className="max-w-xs">
								<CardHeader theme={theme}>
									<CardTitle theme={theme}>Card Title</CardTitle>
								</CardHeader>
								<CardContent theme={theme}>
									<p
										className="text-sm"
										style={{ color: isDark ? "#6b7a99" : "#6b7280" }}
									>
										Card body content goes here.
									</p>
								</CardContent>
								<CardFooter theme={theme}>
									<Button size="sm" theme={theme}>
										Action
									</Button>
								</CardFooter>
							</Card>
						</ComponentSection>

						{/* ── 05 Table ── */}
						<ComponentSection id="table" index={5} title="Table" theme={theme}>
							<Table theme={theme}>
								<TableHeader theme={theme}>
									<TableRow theme={theme}>
										<TableHead theme={theme}>Name</TableHead>
										<TableHead theme={theme}>Role</TableHead>
										<TableHead theme={theme}>Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody theme={theme}>
									{TABLE_DATA.map((r) => (
										<TableRow key={r.name} theme={theme}>
											<TableCell theme={theme}>{r.name}</TableCell>
											<TableCell theme={theme}>{r.role}</TableCell>
											<TableCell theme={theme}>
												<Badge
													theme={theme}
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
						<ComponentSection
							id="skeleton"
							index={6}
							title="Skeleton"
							theme={theme}
						>
							<div className="space-y-3 max-w-xs">
								<Skeleton theme={theme} className="h-4 w-40" />
								<div className="flex items-center gap-3">
									<Skeleton theme={theme} className="h-9 w-9 rounded-full" />
									<div className="space-y-1.5 flex-1">
										<Skeleton theme={theme} className="h-3 w-3/4" />
										<Skeleton theme={theme} className="h-3 w-1/2" />
									</div>
								</div>
								<Skeleton theme={theme} className="h-20 w-full" />
							</div>
						</ComponentSection>

						{/* ── 07 Dialog ── */}
						<ComponentSection
							id="dialog"
							index={7}
							title="Dialog"
							theme={theme}
						>
							<Button theme={theme} onClick={() => setDialogOpen(true)}>
								Open Dialog
							</Button>
							<Dialog
								open={dialogOpen}
								onClose={() => setDialogOpen(false)}
								title="Confirm Action"
								theme={theme}
							>
								<p
									className="text-sm"
									style={{ color: isDark ? "#6b7a99" : "#6b7280" }}
								>
									Are you sure you want to continue? This action cannot be
									undone.
								</p>
								<div className="mt-5 flex justify-end gap-2">
									<Button
										variant="secondary"
										size="sm"
										theme={theme}
										onClick={() => setDialogOpen(false)}
									>
										Cancel
									</Button>
									<Button
										size="sm"
										theme={theme}
										onClick={() => setDialogOpen(false)}
									>
										Confirm
									</Button>
								</div>
							</Dialog>
						</ComponentSection>

						{/* ── 08 Toast ── */}
						<ComponentSection id="toast" index={8} title="Toast" theme={theme}>
							<Group label="trigger" theme={theme}>
								<Button
									size="sm"
									theme={theme}
									onClick={() => toast.show("Changes saved.", "success")}
								>
									Success
								</Button>
								<Button
									size="sm"
									variant="danger"
									theme={theme}
									onClick={() => toast.show("Request failed.", "error")}
								>
									Error
								</Button>
								<Button
									size="sm"
									variant="secondary"
									theme={theme}
									onClick={() => toast.show("Notification sent.")}
								>
									Default
								</Button>
							</Group>
							<Toast {...toast.toastProps} theme={theme} />
						</ComponentSection>
					</div>
				</div>
			</div>
		</main>
	);
}
