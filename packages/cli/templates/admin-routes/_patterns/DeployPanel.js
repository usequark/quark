/**
 * DeployPanel pattern — project / deployment controls.
 *
 * A neutral panel for surfacing deployment actions and status. Deliberately
 * plain Tailwind gray; wire it to your own deploy flow (Railway, Vercel, etc.).
 *
 * @param {{
 *   title?: string,
 *   description?: string,
 *   actions?: { label: string, href?: string, onClick?: () => void }[],
 * }} props
 */
export default function DeployPanel({
	title = "Deployment",
	description = "Manage project and deployment controls.",
	actions = [],
}) {
	return (
		<div className="rounded-lg border border-gray-200 bg-white p-5">
			<h2 className="text-sm font-semibold text-gray-900">{title}</h2>
			<p className="mt-1 text-sm text-gray-500">{description}</p>
			{actions.length > 0 && (
				<div className="mt-4 flex flex-wrap gap-2">
					{actions.map((action) => (
						<button
							key={action.label}
							type="button"
							onClick={action.onClick}
							className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
						>
							{action.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
