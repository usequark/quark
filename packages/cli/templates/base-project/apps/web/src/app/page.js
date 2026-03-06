// No @techstream/quark-ui imports — this page is part of the base template.
// If you scaffolded the ui package, you can replace these with your components.
export default function Home() {
	return (
		<main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
			<div className="max-w-2xl w-full text-center space-y-8">
				{/* Logo / wordmark */}
				<div className="space-y-3">
					<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white text-2xl font-bold shadow-lg">
						Q
					</div>
					<h1 className="text-4xl font-bold text-gray-900 tracking-tight">
						Your Quark App
					</h1>
					<p className="text-lg text-gray-500 max-w-md mx-auto">
						A full-stack Next.js application scaffolded with Quark. Edit this
						page to get started.
					</p>
				</div>

				{/* Quick links */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
					<a
						href="/api/health"
						className="group block rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
					>
						<div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
							Health check
						</div>
						<div className="mt-1 text-xs text-gray-500">/api/health</div>
					</a>
					<a
						href="/api/auth/signin"
						className="group block rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
					>
						<div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
							Sign in
						</div>
						<div className="mt-1 text-xs text-gray-500">/api/auth/signin</div>
					</a>
					<a
						href="https://github.com/Bobnoddle/quark"
						target="_blank"
						rel="noopener noreferrer"
						className="group block rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
					>
						<div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
							Quark docs
						</div>
						<div className="mt-1 text-xs text-gray-500">
							github.com/Bobnoddle/quark
						</div>
					</a>
				</div>
			</div>
		</main>
	);
}
