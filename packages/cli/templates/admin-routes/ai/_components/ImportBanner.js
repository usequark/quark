"use client";

export default function ImportBanner({ onImport, onDismiss }) {
	return (
		<div className="flex items-center justify-between gap-4 bg-primary-muted border border-primary/20 rounded-lg px-4 py-3 mb-4">
			<p className="text-sm text-text">
				Import conversations from the previous version.
			</p>
			<div className="flex items-center gap-2 shrink-0">
				<button
					type="button"
					onClick={onImport}
					className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
				>
					Import
				</button>
				<button
					type="button"
					onClick={onDismiss}
					className="text-sm text-text-muted hover:text-text transition-colors"
				>
					Dismiss
				</button>
			</div>
		</div>
	);
}
