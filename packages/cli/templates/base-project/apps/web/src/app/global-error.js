"use client";

import Link from "next/link";

export default function GlobalError({ reset }) {
	return (
		<html lang="en">
			<body style={{ margin: 0, background: "#05070a" }}>
				<main
					className="fixed inset-0 flex flex-col items-center justify-center"
					style={{ background: "#05070a" }}
				>
					<p
						className="font-mono uppercase"
						style={{
							color: "#3a3a4a",
							fontSize: "11px",
							letterSpacing: "0.15em",
						}}
					>
						500
					</p>
					<p
						className="font-mono mt-2"
						style={{ color: "#2a2a3a", fontSize: "11px" }}
					>
						something went wrong
					</p>
					<nav
						className="mt-6 flex items-center gap-2"
						style={{ fontSize: "11px", fontFamily: "monospace" }}
					>
						<button
							type="button"
							onClick={reset}
							className="quark-home-link"
							style={{
								background: "none",
								border: "none",
								padding: 0,
								cursor: "pointer",
							}}
						>
							try again
						</button>
						<span style={{ color: "#2a2a3a" }}>·</span>
						<Link href="/" className="quark-home-link">
							← home
						</Link>
					</nav>
				</main>
			</body>
		</html>
	);
}
