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
	Container,
	Dialog,
	Footer,
	FormField,
	Input,
	Label,
	Lightbox,
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
				§ {num} - {title}
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
	const [layoutPreviewType, setLayoutPreviewType] = useState(null);
	const [lightboxOpen, setLightboxOpen] = useState(false);
	const toast = useToast();

	const layoutPreviewTitle =
		layoutPreviewType === "navbar"
			? "Desktop Navbar Preview"
			: layoutPreviewType === "mobile-navbar"
				? "Mobile Navbar Preview"
				: "Footer Preview";

	function renderLayoutPreview() {
		switch (layoutPreviewType) {
			case "navbar":
				return (
					<div className="bg-bg pb-56">
						<Navbar logo="Quark" action={{ label: "Get Started", href: "#" }} />
						<div className="px-4 pt-6 text-sm text-text-muted sm:px-6 lg:px-8">
							Open &ldquo;Services&rdquo; or &ldquo;Company&rdquo; to inspect
							desktop dropdown menus.
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

						{/* ── 03 Form Controls ── */}
						<ComponentSection
							id="form-controls"
							index={3}
							title="Form Controls"
						>
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

						{/* ── 04 FormField ── */}
						<ComponentSection id="formfield" index={4} title="FormField">
							<div className="max-w-xs space-y-4">
								<FormField label="Name" name="name" placeholder="Your name" />
								<FormField
									label="Email"
									name="email"
									type="email"
									placeholder="you@example.com"
									error="Please enter a valid email"
								/>
								<FormField label="Message" name="message">
									<Textarea placeholder="Write your message…" rows={3} />
								</FormField>
							</div>
						</ComponentSection>

						{/* ── 05 Card ── */}
						<ComponentSection id="card" index={5} title="Card">
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

						{/* ── 06 Container ── */}
						<ComponentSection id="container" index={6} title="Container">
							<Container className="max-w-sm p-6">
								<p className="text-sm font-semibold text-text">
									Container shell
								</p>
								<p className="mt-1 text-sm text-text-muted">
									A minimal wrapper with rounded corners, border, and surface
									background. Compose with any content.
								</p>
							</Container>
						</ComponentSection>

						{/* ── 07 Lightbox ── */}
						<ComponentSection id="lightbox" index={7} title="Lightbox">
							<p className="text-sm leading-6 text-text-muted">
								A bare overlay image viewer. Compose your own thumbnail grid
								from Card/Button, then open the Lightbox on click.
							</p>
							<Button onClick={() => setLightboxOpen(true)}>
								Open Lightbox
							</Button>
							<Lightbox
								src="https://picsum.photos/id/1015/1800/1100"
								alt="Snow-capped mountain range above a winding lake"
								caption="Wide landscape sample"
								open={lightboxOpen}
								onClose={() => setLightboxOpen(false)}
							/>
						</ComponentSection>

						{/* ── 08 Dialog ── */}
						<ComponentSection id="dialog" index={8} title="Dialog">
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

						{/* ── 09 Toast ── */}
						<ComponentSection id="toast" index={9} title="Toast">
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

						{/* ── 10 Skeleton ── */}
						<ComponentSection id="skeleton" index={10} title="Skeleton">
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

						{/* ── 11 Table ── */}
						<ComponentSection id="table" index={11} title="Table">
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

						{/* ── 12 Navbar & Footer ── */}
						<ComponentSection
							id="navbar-footer"
							index={12}
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
