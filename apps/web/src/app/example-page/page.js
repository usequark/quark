import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Footer,
	MobileNavbar,
	Navbar,
} from "@techstream/quark-ui";
import { getPageMetadata } from "../../lib/seo/site-metadata.js";

export const metadata = getPageMetadata({
	title: "Quark Example Page",
	description:
		"A production-style public page built from the shared Quark UI package.",
	path: "/example-page",
});

const NAV_LINKS = [
	{ label: "Home", href: "/" },
	{ label: "Playground", href: "/playground" },
];

export default function ExamplePage() {
	return (
		<div className="min-h-screen bg-bg text-text">
			<div className="sticky top-0 z-50 hidden md:block">
				<Navbar
					logo="Quark"
					logoHref="/"
					links={NAV_LINKS}
					action={{ label: "Open playground", href: "/playground" }}
					maxWidthClassName="max-w-7xl"
				/>
			</div>
			<div className="sticky top-0 z-50 md:hidden">
				<MobileNavbar
					logo="Quark"
					logoHref="/"
					links={NAV_LINKS}
					action={{ label: "Playground", href: "/playground" }}
					maxWidthClassName="max-w-7xl"
				/>
			</div>

			<main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
				<section className="space-y-8">
					<div className="space-y-5">
						<Badge variant="info" className="w-fit">
							Public UI reference
						</Badge>
						<h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-text sm:text-5xl">
							Build public pages from the scaffolded Quark UI package.
						</h1>
						<p className="max-w-2xl text-base leading-7 text-text-muted sm:text-lg">
							This page demonstrates shared layout and content primitives
							composed into a production-style public route.
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
						{[
							{
								label: "Shared shell",
								value: "Navbar, Footer",
								description:
									"Use scaffolded layout components before inventing wrappers.",
							},
							{
								label: "Reusable blocks",
								value: "Card, Badge, Button",
								description:
									"Compose public sections from the same primitives the dashboard uses.",
							},
							{
								label: "Design tokens",
								value: "CSS variables",
								description:
									"Theme tokens drive all component styles — override to retheme.",
							},
						].map((item) => (
							<Card key={item.label} className="bg-surface/90 backdrop-blur-sm">
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
				</section>

				<section className="mt-16">
					<Card className="border-border/80 bg-surface/95">
						<CardHeader className="space-y-3">
							<Badge variant="success" className="w-fit">
								Get started
							</Badge>
							<CardTitle className="text-2xl text-text">
								Inspect the shared package first, then customize from there.
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm leading-6 text-text-muted">
								Check{" "}
								<code className="rounded bg-surface-hover px-1.5 py-0.5 text-xs">
									packages/ui/README.md
								</code>
								, this route, and{" "}
								<code className="rounded bg-surface-hover px-1.5 py-0.5 text-xs">
									/playground
								</code>{" "}
								before opening a blank file.
							</p>
						</CardContent>
					</Card>
				</section>
			</main>

			<Footer
				brandName="Quark"
				brandDescription="A public-page reference for Quark. Demonstrates how the shared UI package scales beyond auth and admin surfaces."
				ctaLabel="Open the playground"
				ctaHref="/playground"
				columns={[
					{
						title: "Reference",
						links: [
							{ label: "Example page", href: "/example-page" },
							{ label: "Playground", href: "/playground" },
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
						],
					},
				]}
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
