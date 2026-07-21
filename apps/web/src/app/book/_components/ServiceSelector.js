"use client";

const LANE_ICONS = {
	"Hack Attack Machine": (
		<svg
			className="h-5 w-5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="10" />
			<circle cx="12" cy="12" r="3" />
			<path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
		</svg>
	),
	"Tee Lane": (
		<svg
			className="h-5 w-5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="2" y="3" width="20" height="6" rx="2" />
			<path d="M12 9v12" />
			<path d="M8 21h8" />
		</svg>
	),
	"3 Wheel Machine": (
		<svg
			className="h-5 w-5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="8" r="6" />
			<circle cx="6" cy="18" r="4" />
			<circle cx="18" cy="18" r="4" />
		</svg>
	),
	"Pitching Lane": (
		<svg
			className="h-5 w-5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M12 2v20" />
			<path d="M4 7l4 4-4 4M20 7l-4 4 4 4" />
		</svg>
	),
};

const DEFAULT_ICON = (
	<svg
		className="h-5 w-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 6v6l4 2" />
	</svg>
);

export default function ServiceSelector({
	services,
	selectedId,
	onSelect,
	error,
}) {
	if (!services || services.length === 0) {
		return (
			<p className="text-sm text-text-muted">
				No lane types available. Please check back later.
			</p>
		);
	}

	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{services.map((service) => {
				const isSelected = selectedId === service.id;
				const icon = LANE_ICONS[service.name] || DEFAULT_ICON;
				return (
					<button
						key={service.id}
						type="button"
						onClick={() => onSelect(service.id)}
						className={`group relative overflow-hidden rounded-[--radius-default] border p-5 text-left transition-all duration-200 cursor-pointer ${
							isSelected
								? "border-primary bg-primary-muted/20 shadow-[0_0_0_1px_var(--color-primary)] shadow-primary/30"
								: "border-border bg-surface hover:border-primary/30 hover:shadow-[0_4px_16px_rgba(55,125,255,0.06)]"
						}`}
					>
						{isSelected && (
							<div className="absolute top-0 right-0 h-12 w-12 -translate-y-6 translate-x-6 rotate-45 bg-primary" />
						)}
						<div className="flex items-start gap-4">
							<div
								className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
									isSelected
										? "bg-primary text-white shadow-lg shadow-primary/30"
										: "bg-surface-hover text-text-muted group-hover:text-primary group-hover:bg-primary/10"
								}`}
							>
								{icon}
							</div>
							<div className="min-w-0 space-y-1.5">
								<p className="font-semibold text-text">{service.name}</p>
								{service.description && (
									<p className="text-sm leading-5 text-text-muted line-clamp-2">
										{service.description}
									</p>
								)}
								<div className="flex items-center gap-3 pt-0.5">
									<span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-text-muted">
										{service.duration} min
									</span>
									{service.price != null && service.price > 0 && (
										<span
											className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-primary"}`}
										>
											${service.price.toFixed(2)}
											<span className="text-text-faint text-xs font-normal">
												{" "}
												/ 30 min
											</span>
										</span>
									)}
								</div>
							</div>
						</div>
					</button>
				);
			})}
			{error && <p className="text-sm text-red-500 col-span-2">{error[0]}</p>}
		</div>
	);
}
