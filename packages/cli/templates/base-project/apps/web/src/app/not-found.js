import Link from "next/link";

export const metadata = {
	title: "Not Found",
};

export default function NotFound() {
	return (
		<main
			className="fixed inset-0 flex flex-col items-center justify-center"
			style={{ background: "var(--color-bg, #05070a)" }}
		>
			<p
				className="font-mono uppercase"
				style={{
					color: "var(--color-text-faint, #3a3a4a)",
					fontSize: "11px",
					letterSpacing: "0.15em",
				}}
			>
				404
			</p>
			<p
				className="font-mono mt-2"
				style={{ color: "var(--color-text-faint, #2a2a3a)", fontSize: "11px" }}
			>
				page not found
			</p>
			<nav
				className="mt-6"
				style={{ fontSize: "11px", fontFamily: "monospace" }}
			>
				<Link href="/" className="quark-home-link">
					← home
				</Link>
			</nav>
		</main>
	);
}
