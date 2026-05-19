"use client";
import {
	BackgroundAurora,
	BackgroundDataStream,
	BackgroundGrid,
	BackgroundIsometric,
	BackgroundPolygon,
	BackgroundStars,
	BackgroundStreaks,
	BackgroundVapor,
	BackgroundWaves,
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
	Section,
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

const ANIMATIONS = [
	{
		key: "waves",
		label: "Waves",
		Component: BackgroundWaves,
		props: {
			colors: {
				back: "rgba(14, 165, 233, 0.3)",
				mid: "rgba(2, 132, 199, 0.4)",
				front: "rgba(3, 105, 161, 0.5)",
			},
		},
	},
	{
		key: "data-stream",
		label: "Data Stream",
		Component: BackgroundDataStream,
		props: { variant: "light" },
	},
	{
		key: "isometric",
		label: "Isometric",
		Component: BackgroundIsometric,
		props: { color: "#818cf8", opacity: 0.55 },
	},
	{
		key: "vapor",
		label: "Vapor",
		Component: BackgroundVapor,
		props: {},
	},
	{
		key: "aurora",
		label: "Aurora",
		Component: BackgroundAurora,
		props: {
			colors: {
				a: "rgba(14, 165, 233, 0.6)",
				b: "rgba(109, 40, 217, 0.5)",
				c: "rgba(6, 182, 212, 0.55)",
			},
		},
	},
	{
		key: "polygon",
		label: "Polygon",
		Component: BackgroundPolygon,
		props: {},
		theme: "dark",
	},
	{
		key: "stars",
		label: "Stars",
		Component: BackgroundStars,
		props: {},
		theme: "dark",
	},
	{
		key: "streaks",
		label: "Streaks",
		Component: BackgroundStreaks,
		props: {},
		theme: "dark",
	},
	{
		key: "grid",
		label: "Grid",
		Component: BackgroundGrid,
		props: {},
	},
];

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
	const [animationKey, setAnimationKey] = useState("aurora");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [layoutPreviewType, setLayoutPreviewType] = useState(null);
	const [sectionPreviewType, setSectionPreviewType] = useState("hero");
	const toast = useToast();

	const sectionPreviewTitle =
		sectionPreviewType === "hero"
			? "Hero Section Preview"
			: sectionPreviewType === "default"
				? "Default Page Section Preview"
				: sectionPreviewType === "split"
					? "Split Page Section Preview"
					: "CTA Section Preview";

	const layoutPreviewTitle =
		layoutPreviewType === "navbar"
			? "Desktop Navbar Preview"
			: layoutPreviewType === "mobile-navbar"
				? "Mobile Navbar Preview"
				: "Footer Preview";

	function renderSectionPreview() {
		switch (sectionPreviewType) {
			case "hero":
				return (
					<Section
						type="hero"
						title="Build Confidence With Every Release"
						subtitle="Ship production-ready updates faster with a slim hero designed to orient users immediately."
						backgroundMode="animation"
						backgroundValue="Aurora"
					/>
				);
			case "default":
				return (
					<Section
						type="default"
						eyebrow="Platform"
						title="A simple section that keeps content readable"
						body="The default page section keeps hierarchy clear with a compact eyebrow and heading pair above comfortable body copy.\n\nUse this layout for most paragraphs where clarity matters more than visual complexity."
					/>
				);
			case "split":
				return (
					<Section
						type="split"
						eyebrow="Workflow"
						title="Pair narrative copy with supporting media"
						leftKind="text"
						leftBody="Use text on one side to explain the message while the second side supports the story with visuals.\n\nThe layout stacks naturally on smaller viewports."
						rightKind="image"
						rightSrc="https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1200&q=80"
						rightAlt="Design collaboration workspace"
					/>
				);
			case "cta":
				return (
					<Section
						type="cta"
						title="Ready to map your next release?"
						subtitle="Use the CTA section at the bottom of pages to route users to their next high-value action."
						primaryAction={{ label: "Book demo", href: "#" }}
						secondaryAction={{ label: "View docs", href: "#" }}
						backgroundMode="color"
						backgroundValue="primary"
					/>
				);
			default:
				return null;
		}
	}

	function renderLayoutPreview() {
		switch (layoutPreviewType) {
			case "navbar":
				return (
					<div className="bg-bg pb-56">
						<Navbar logo="Quark" action={{ label: "Get Started", href: "#" }} />
						<div className="px-4 pt-6 text-sm text-text-muted sm:px-6 lg:px-8">
							Open "Services" or "Company" to inspect desktop dropdown menus.
						</div>
					</div>
				);
			case "mobile-navbar":
				return (
					<div className="bg-bg py-6 px-4">
						<div className="mx-auto max-w-md rounded-[--radius-default] border border-border bg-surface">
							<MobileNavbar
								logo="Quark"
								action={{ label: "Get Started", href: "#" }}
							/>
							<div className="min-h-[28rem] px-4 py-6 text-sm text-text-muted">
								Open the menu icon to inspect the mobile navigation panel.
							</div>
						</div>
					</div>
				);
			case "footer":
				return (
					<div className="bg-bg">
						<Footer
							brandName="Quark"
							brandDescription="Ship production-ready apps with a practical full-stack toolkit built for velocity."
							ctaLabel="Start Building"
							ctaHref="#"
							poweredByText="Powered by Quark"
							poweredByHref="#"
						/>
					</div>
				);
			default:
				return null;
		}
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
							<div className="grid gap-4 sm:grid-cols-2">
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

								<Card
									variant="collapsible"
									collapsibleLabel="Expandable Card"
									className="max-w-xs bg-surface shadow-sm"
								>
									<div className="space-y-3">
										<p className="text-sm text-text-muted">
											This card starts collapsed and expands to reveal
											additional content.
										</p>
										<Button size="md" variant="secondary">
											Learn More
										</Button>
									</div>
								</Card>
							</div>
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

						{/* ── 09 Sections ── */}
						<ComponentSection id="sections" index={9} title="Sections">
							<Group label="preview overlays">
								<Button
									variant={
										sectionPreviewType === "hero" ? "primary" : "secondary"
									}
									onClick={() => setSectionPreviewType("hero")}
								>
									Hero Section
								</Button>
								<Button
									variant={
										sectionPreviewType === "default" ? "primary" : "secondary"
									}
									onClick={() => setSectionPreviewType("default")}
								>
									Default Page Section
								</Button>
								<Button
									variant={
										sectionPreviewType === "split" ? "primary" : "secondary"
									}
									onClick={() => setSectionPreviewType("split")}
								>
									Split Page Section
								</Button>
								<Button
									variant={
										sectionPreviewType === "cta" ? "primary" : "secondary"
									}
									onClick={() => setSectionPreviewType("cta")}
								>
									CTA Section
								</Button>
							</Group>
							<div className="mt-4 overflow-hidden rounded-[--radius-default] border border-border bg-surface">
								<div className="flex items-center justify-between border-b border-border px-4 py-3">
									<p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
										{sectionPreviewTitle}
									</p>
								</div>
								<div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6">
									{renderSectionPreview()}
								</div>
							</div>
						</ComponentSection>
						{/* ── 10 Navbar & Footer ── */}
						<ComponentSection
							id="navbar-footer"
							index={10}
							title="Navbar & Footer"
						>
							<Group label="open preview overlay">
								<Button
									variant={
										layoutPreviewType === "navbar" ? "primary" : "secondary"
									}
									onClick={() => setLayoutPreviewType("navbar")}
								>
									Navbar
								</Button>
								<Button
									variant={
										layoutPreviewType === "mobile-navbar"
											? "primary"
											: "secondary"
									}
									onClick={() => setLayoutPreviewType("mobile-navbar")}
								>
									Mobile Navbar
								</Button>
								<Button
									variant={
										layoutPreviewType === "footer" ? "primary" : "secondary"
									}
									onClick={() => setLayoutPreviewType("footer")}
								>
									Footer
								</Button>
							</Group>
						</ComponentSection>

						{/* ── 11 Animations ── */}
						<ComponentSection
							id="animations"
							index={11}
							title="Background Animations"
						>
							<Group label="select animation">
								{ANIMATIONS.map(({ key, label }) => (
									<Button
										key={key}
										variant={animationKey === key ? "primary" : "secondary"}
										onClick={() => setAnimationKey(key)}
									>
										{label}
									</Button>
								))}
							</Group>
							{(() => {
								const active = ANIMATIONS.find((a) => a.key === animationKey);
								const { Component, props: animProps, theme = "light" } = active;
								const isDark = theme === "dark";
								return (
									<div
										className={`relative overflow-hidden rounded-[--radius-default] border border-border h-72 ${isDark ? "bg-slate-950" : "bg-white"}`}
									>
										<Component className="z-0" {...animProps} />
										<div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 text-center px-6">
											<p
												className={`font-mono uppercase text-[11px] tracking-[0.2em] ${isDark ? "text-white/40" : "text-slate-400"}`}
											>
												Background · {active.label}
											</p>
											<h3
												className={`text-2xl font-semibold ${isDark ? "text-white" : "text-slate-800"}`}
											>
												Text remains readable
											</h3>
											<p
												className={`text-sm max-w-sm ${isDark ? "text-white/60" : "text-slate-500"}`}
											>
												Animations sit behind content without disrupting
												legibility.
											</p>
										</div>
									</div>
								);
							})()}
						</ComponentSection>
					</div>
				</div>
			</main>

			{layoutPreviewType ? (
				<div className="fixed inset-x-0 bottom-0 z-60 border-t border-border bg-bg/95 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] backdrop-blur">
					<div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 lg:px-8">
						<p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
							{layoutPreviewTitle}
						</p>
						<Button
							variant="secondary"
							onClick={() => setLayoutPreviewType(null)}
						>
							Close
						</Button>
					</div>
					<div className="max-h-[88vh] overflow-y-auto">
						{renderLayoutPreview()}
					</div>
				</div>
			) : null}
		</div>
	);
}
