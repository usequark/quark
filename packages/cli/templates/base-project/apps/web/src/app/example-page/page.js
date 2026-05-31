import {
	Badge,
	Button,
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
	Footer,
	Input,
	Label,
	MobileNavbar,
	Navbar,
	Textarea,
} from "@techstream/quark-ui";

export const metadata = {
	title: "Quark Example Page",
	description:
		"A production-style public page built from the shared Quark UI package.",
};

const NAV_LINKS = [
	{ label: "Why Quark", href: "#why-quark" },
	{ label: "Reference", href: "#reference" },
	{
		label: "Packages",
		items: [
			{ label: "UI primitives", href: "#reference" },
			{ label: "Playground", href: "/playground" },
			{ label: "Home", href: "/" },
		],
	},
	{ label: "Start", href: "#start" },
];

const HERO_POINTS = [
	{
		label: "Shared shell",
		value: "Navbar, MobileNavbar, Footer",
		description:
			"Use the scaffolded layout components before inventing wrappers.",
	},
	{
		label: "Reusable blocks",
		value: "Card, Badge, Button",
		description:
			"Compose public sections from the same primitives the dashboard uses.",
	},
	{
		label: "Lead capture",
		value: "Input, Label, Textarea",
		description:
			"Form controls already match the theme tokens and focus states.",
	},
];

const REFERENCE_CARDS = [
	{
		eyebrow: "01",
		title: "Start from the shared package",
		copy: "Public pages should begin with the scaffolded UI exports. Reach for className overrides or package-local edits before duplicating base markup.",
		badge: "info",
	},
	{
		eyebrow: "02",
		title: "Keep public and admin surfaces aligned",
		copy: "The same cards, buttons, status labels, and feedback patterns can cover marketing pages, dashboards, and operational tools without branching into separate design systems.",
		badge: "success",
	},
	{
		eyebrow: "03",
		title: "Use example routes as the first reference",
		copy: "This page complements /playground by showing how shared primitives combine into a production-style public page instead of an isolated component catalog.",
		badge: "warning",
	},
];

const PLAYBOOK = [
	{
		title: "Reference first",
		copy: "Inspect packages/ui/README.md, this route, and /playground before opening a blank file.",
	},
	{
		title: "Compose with tokens",
		copy: "Tailwind utilities already bridge to the design tokens in globals.css, so shared components inherit brand changes without bespoke CSS.",
	},
	{
		title: "Edit the package when the pattern repeats",
		copy: "If a layout pattern shows up twice, move it into packages/ui instead of proliferating one-off page helpers.",
	},
	{
		title: "Keep the route shippable",
		copy: "A public example should look like a real starter page, not a hidden demo. That keeps it discoverable for both humans and agents.",
	},
];

const FOOTER_COLUMNS = [
	{
		title: "Reference",
		links: [
			{ label: "Example page", href: "/example-page" },
			{ label: "Playground", href: "/playground" },
			{
				label: "CLI package",
				href: "https://www.npmjs.com/package/@techstream/quark-create-app",
			},
		],
	},
	{
		title: "Packages",
		links: [
			{
				label: "Core runtime",
				href: "https://www.npmjs.com/package/@techstream/quark-core",
			},
			{ label: "Home", href: "/" },
			{ label: "Docs", href: "https://github.com/Bobnoddle/quark" },
		],
	},
	{
		title: "Start building",
		links: [
			{ label: "Use @techstream/quark-ui first" },
			{ label: "Extend with className or package edits" },
			{ label: "Sync templates after source changes" },
		],
	},
];

function SectionIntro({ eyebrow, title, copy }) {
	return (
		<div className="max-w-3xl space-y-3">
			<p className="font-mono text-xs uppercase tracking-[0.24em] text-text-faint">
				{eyebrow}
			</p>
			<h2 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">
				{title}
			</h2>
			<p className="text-base leading-7 text-text-muted sm:text-lg">{copy}</p>
		</div>
	);
}

export default function ExamplePage() {
	return (
		<div className="min-h-screen bg-bg text-text">
			<div className="hidden md:block">
				<Navbar
					logo="Quark"
					logoHref="/"
					links={NAV_LINKS}
					action={{ label: "Open playground", href: "/playground" }}
					maxWidthClassName="max-w-7xl"
				/>
			</div>
			<div className="md:hidden">
				<MobileNavbar
					logo="Quark"
					logoHref="/"
					links={NAV_LINKS}
					action={{ label: "Playground", href: "/playground" }}
					maxWidthClassName="max-w-7xl"
				/>
			</div>

			<main className="quark-page-grid">
				<section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:px-8 lg:py-20">
					<div className="space-y-8">
						<div className="space-y-5">
							<Badge variant="info" className="w-fit">
								Public UI reference route
							</Badge>
							<h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-text sm:text-5xl lg:text-6xl">
								Build public pages from the scaffolded Quark UI package.
							</h1>
							<p className="max-w-2xl text-base leading-7 text-text-muted sm:text-lg">
								This page is intentionally composed from shared layout and
								content primitives so it can act as the first public-route
								reference for agents and humans working in Quark.
							</p>
						</div>

						<div className="flex flex-wrap gap-3">
							<Button href="/playground" size="lg" variant="solid">
								Open component playground
							</Button>
							<Button
								href="https://www.npmjs.com/package/@techstream/quark-create-app"
								target="_blank"
								variant="outline"
								size="lg"
							>
								View create-app package
							</Button>
						</div>

						<div className="grid gap-4 sm:grid-cols-3">
							{HERO_POINTS.map((item) => (
								<Card
									key={item.label}
									className="bg-surface/90 backdrop-blur-sm"
								>
									<CardContent className="space-y-3 pt-6">
										<p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
											{item.label}
										</p>
										<p className="text-lg font-semibold text-text">
											{item.value}
										</p>
										<p className="text-sm leading-6 text-text-muted">
											{item.description}
										</p>
									</CardContent>
								</Card>
							))}
						</div>
					</div>

					<Card
						id="start"
						className="border-border/80 bg-surface/95 shadow-[0_12px_45px_rgba(0,0,0,0.18)]"
					>
						<CardHeader className="space-y-3">
							<Badge variant="success" className="w-fit">
								Starter composition
							</Badge>
							<CardTitle className="text-2xl text-text sm:text-3xl">
								Use the shared package first, then customize from there.
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="example-project-name">Project name</Label>
									<Input
										id="example-project-name"
										name="projectName"
										placeholder="Precision Ops Portal"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="example-primary-cta">Primary CTA</Label>
									<Input
										id="example-primary-cta"
										name="primaryCta"
										placeholder="Book an implementation call"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="example-brief">Public-page brief</Label>
								<Textarea
									id="example-brief"
									name="brief"
									placeholder="Describe the landing page, trust signals, and conversion goal you need."
									rows={5}
								/>
							</div>
							<p className="text-sm leading-6 text-text-muted">
								This card uses the same package-local form controls as the rest
								of the scaffold, so theme, spacing, and focus states stay
								aligned.
							</p>
						</CardContent>
						<CardFooter className="flex flex-wrap gap-3">
							<Button href="/playground" variant="solid">
								Audit components
							</Button>
							<Button href="/example-page" variant="secondary">
								Reuse this layout
							</Button>
						</CardFooter>
					</Card>
				</section>

				<section
					id="why-quark"
					className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-18"
				>
					<SectionIntro
						eyebrow="Shared building blocks"
						title="A public page should demonstrate the real scaffold, not bypass it."
						copy="These cards show the first decisions an agent should make in a Quark project: inspect the shared package, compose from existing primitives, and only then introduce package-level extensions."
					/>
					<div id="reference" className="mt-8 grid gap-4 lg:grid-cols-3">
						{REFERENCE_CARDS.map((item) => (
							<Card key={item.title} className="h-full bg-surface/92">
								<CardHeader className="space-y-3">
									<Badge variant={item.badge} className="w-fit">
										{item.eyebrow}
									</Badge>
									<CardTitle className="text-xl text-text">
										{item.title}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm leading-6 text-text-muted">
										{item.copy}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
				</section>

				<section className="mx-auto max-w-7xl px-4 pb-18 sm:px-6 lg:px-8 lg:pb-24">
					<SectionIntro
						eyebrow="Agent playbook"
						title="What to do before opening a blank public page file."
						copy="Keep the first reference local and concrete. When a Quark task mentions a landing page, marketing section, waitlist, or dashboard shell, the shared UI package should be the default starting point."
					/>
					<div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						{PLAYBOOK.map((item, index) => (
							<Card key={item.title} className="h-full bg-surface/90">
								<CardHeader className="space-y-3">
									<p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
										Step {index + 1}
									</p>
									<CardTitle className="text-lg text-text">
										{item.title}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm leading-6 text-text-muted">
										{item.copy}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
				</section>
			</main>

			<Footer
				brandName="Quark"
				brandDescription="Use this route as the default public-page reference in Quark. It demonstrates how the shared UI package scales beyond auth and admin surfaces."
				ctaLabel="Open the playground"
				ctaHref="/playground"
				columns={FOOTER_COLUMNS}
				copyrightText="Copyright 2026 Quark"
				legalLinks={[
					{ label: "Example page", href: "/example-page" },
					{ label: "Playground", href: "/playground" },
				]}
				poweredByText="Scaffolded with @techstream/quark-create-app"
				poweredByHref="https://www.npmjs.com/package/@techstream/quark-create-app"
				mark={
					<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-muted text-sm font-semibold text-primary sm:h-12 sm:w-12">
						QK
					</span>
				}
			/>
		</div>
	);
}
