import HealthIndicator from "./_components/HealthIndicator.js";
import HomeThemeToggle from "./_components/HomeThemeToggle.js";
import QuarkAnimation from "./_components/QuarkAnimation.js";

const PROMPTS = [
	"A landing page for a B2B SaaS product",
	"A booking system with calendar views",
	"A customer dashboard with analytics",
	"A internal admin panel",
];

export default function Home() {
	return (
		<main className="quark-home-main min-h-screen flex flex-col items-center justify-center">
			<QuarkAnimation />

			<div className="quark-home-footer flex flex-col items-center gap-6 pt-8 pb-8">
				<p className="quark-home-label font-mono uppercase">Your Quark App</p>

				{/* Build prompt */}
				<div className="quark-home-prompt max-w-lg w-full px-4">
					<p className="quark-home-prompt-label font-mono uppercase text-center">
						What do you want to build?
					</p>
					<ul className="quark-home-prompt-list">
						{PROMPTS.map((prompt) => (
							<li key={prompt} className="quark-home-prompt-item">
								<span className="quark-home-prompt-chevron">{">"}</span>
								{prompt}
							</li>
						))}
					</ul>
				</div>

				{/* External links */}
				<nav className="flex items-center gap-2">
					<a
						href="https://github.com/Bobnoddle/quark"
						target="_blank"
						rel="noopener noreferrer"
						className="quark-home-link"
					>
						github
					</a>
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
					<a
						href="https://quark.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="quark-home-link"
					>
						quark
					</a>
					<span className="quark-home-sep">·</span>
					<HomeThemeToggle />
				</nav>

				<HealthIndicator />
			</div>
		</main>
	);
}
