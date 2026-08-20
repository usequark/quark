import Link from "next/link";

/**
 * Metric-card pattern for the admin dashboard.
 *
 * Renders a single decision-relevant value (record count, health, etc.) in a
 * neutral card. Deliberately plain Tailwind gray — not a design statement.
 *
 * @param {{
 *   label: string,
 *   value: import('react').ReactNode,
 *   hint?: string,
 *   href?: string,
 * }} props
 */
export default function MetricCard({ label, value, hint, href }) {
	const body = (
		<div className="rounded-lg border border-gray-200 bg-white p-5">
			<p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
				{label}
			</p>
			<p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
				{value}
			</p>
			{hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
		</div>
	);

	if (href) {
		return (
			<Link href={href} className="block">
				{body}
			</Link>
		);
	}
	return body;
}
