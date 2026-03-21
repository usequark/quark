import HealthIndicator from "./_components/HealthIndicator.js";
import HomeThemeToggle from "./_components/HomeThemeToggle.js";
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
					<a href="/api/health" className="quark-home-link">
						health
					</a>
					<span className="quark-home-sep">·</span>
					<a href="/playground" className="quark-home-link">
						playground
					</a>
					{/* @quark:start:admin */}
					<span className="quark-home-sep">·</span>
					<a href="/admin" className="quark-home-link">
						admin
					</a>
					{/* @quark:end:admin */}
					<span className="quark-home-sep">·</span>
					<a
						href="https://www.npmjs.com/package/@techstream/quark-create-app"
						target="_blank"
						rel="noopener noreferrer"
						className="quark-home-link"
					>
						npm
					</a>
					<span className="quark-home-sep">·</span>
					<HomeThemeToggle />
				</nav>

				{/* Status — supplementary, last */}
				<HealthIndicator />
			</div>
		</main>
	);
}
