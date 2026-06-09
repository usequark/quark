import { Footer, MobileNavbar, Navbar } from "@techstream/quark-ui";

const NAV_LINKS = [
	{ label: "Home", href: "/" },
	{ label: "Example", href: "/example-page" },
	{ label: "Playground", href: "/playground" },
];

const FOOTER_COLUMNS = [
	{
		title: "Pages",
		links: [
			{ label: "Home", href: "/" },
			{ label: "Example", href: "/example-page" },
			{ label: "Playground", href: "/playground" },
		],
	},
	{
		title: "Resources",
		links: [
			{
				label: "Quark CLI",
				href: "https://www.npmjs.com/package/@techstream/quark-create-app",
			},
			{
				label: "Core Runtime",
				href: "https://www.npmjs.com/package/@techstream/quark-core",
			},
		],
	},
];

export default function PublicLayout({ children }) {
	return (
		<div className="flex min-h-screen flex-col bg-bg text-text">
			<div className="sticky top-0 z-50 hidden md:block">
				<Navbar
					logo="Quark"
					logoHref="/"
					links={NAV_LINKS}
					maxWidthClassName="max-w-7xl"
				/>
			</div>
			<div className="sticky top-0 z-50 md:hidden">
				<MobileNavbar
					logo="Quark"
					logoHref="/"
					links={NAV_LINKS}
					maxWidthClassName="max-w-7xl"
				/>
			</div>
			<main className="flex-1">{children}</main>
			<Footer
				brandName="Quark"
				brandDescription="Built with @techstream/quark-create-app"
				ctaLabel="Explore the docs"
				ctaHref="/example-page"
				columns={FOOTER_COLUMNS}
				copyrightText={`Copyright ${new Date().getFullYear()}`}
				legalLinks={[
					{ label: "Example Page", href: "/example-page" },
					{ label: "Privacy", href: "#" },
					{ label: "Terms", href: "#" },
				]}
				poweredByText="Powered by Quark"
				poweredByHref="https://www.npmjs.com/package/@techstream/quark-create-app"
			/>
		</div>
	);
}
