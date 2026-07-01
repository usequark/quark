import Link from "next/link";
import HealthIndicator from "./_components/HealthIndicator.js";
import QuarkAnimation from "./_components/QuarkAnimation.js";

export default function Home() {
	return (
		<main className="quark-home-main min-h-screen flex flex-col items-center justify-center">
			{/* Hero: animated ASCII logo, centered */}
			<QuarkAnimation />

			{/* Footer — flows naturally below the animation */}
			<div className="quark-home-footer flex flex-col items-center gap-2 pt-8 pb-8">
				{/* Identity */}
				<p className="quark-home-label font-mono uppercase">Your Quark App</p>

				{/* Navigation */}
				<nav className="flex items-center gap-2">
					<Link href="/example-page" className="quark-home-link">
						example page
					</Link>
					<span className="quark-home-sep">·</span>
					<Link href="/playground" className="quark-home-link">
						playground
					</Link>
					{/* @quark:start:admin */}
					<span className="quark-home-sep">·</span>
					<Link href="/admin" className="quark-home-link">
						admin
					</Link>
					{/* @quark:end:admin */}
					<span className="quark-home-sep">·</span>
					<a
						href="https://www.npmjs.com/package/@techstream/quark-create-app"
						target="_blank"
						rel="noopener noreferrer"
						className="quark-home-link"
					>
						npm{" "}
						<svg
							className="quark-home-external-icon"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<path
								d="M13.1667 5H6C5.44772 5 5 5.44772 5 6V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V10.8333M15.5 5H19M19 5V8.5M19 5L9.66667 14.3333"
								stroke="currentColor"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</a>
				</nav>

				{/* Status — supplementary, last */}
				<HealthIndicator />
			</div>
		</main>
	);
}
