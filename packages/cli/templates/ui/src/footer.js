import React from "react";

const footerCls = "border-t border-[--footer-border] bg-[--footer-bg]";
const containerCls = "mx-auto";
const topGridCls =
	"grid gap-8 sm:gap-10 md:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]";
const brandRowCls = "flex items-center gap-3";
const markCls =
	"flex shrink-0 items-center justify-center rounded-2xl bg-[--footer-mark-bg] font-bold text-[--footer-mark-text]";
const brandNameCls =
	"text-2xl font-bold tracking-tight text-[--footer-text] sm:text-3xl";
const brandTextCls = "max-w-md text-sm leading-7 text-[--footer-text-muted]";
const ctaCls =
	"inline-flex w-full items-center justify-center rounded-full border border-[--footer-cta-border] font-semibold text-[--footer-mark-text] transition-colors hover:bg-[--footer-cta-hover-bg] sm:w-auto";
const columnTitleCls = "mb-4 font-semibold text-[--footer-text-faint]";
const columnListCls = "space-y-2.5";
const linkCls =
	"break-words text-[--footer-text-muted] transition-colors hover:text-[--footer-link-hover]";
const textItemCls = "break-words text-[--footer-text-muted]";
const bottomBarCls =
	"mt-8 border-t border-[--footer-border] pt-5 flex flex-col gap-3 text-sm text-[--footer-text-faint] sm:mt-10 sm:pt-6 lg:flex-row lg:items-center lg:justify-between";
const legalCls = "flex flex-wrap items-center gap-2 sm:gap-3";
const sepCls = "text-[var(--footer-sep)]";

const DEFAULT_COLUMNS = [
	{
		title: "Lorem",
		links: [
			{ label: "Lorem", href: "#" },
			{ label: "Ipsum", href: "#" },
			{ label: "Dolor", href: "#" },
			{ label: "Sit", href: "#" },
			{ label: "Amet", href: "#" },
		],
	},
	{
		title: "Ipsum",
		links: [
			{ label: "Consectetur", href: "#" },
			{ label: "Adipiscing", href: "#" },
			{ label: "Elit Sed", href: "#" },
			{ label: "Tempor", href: "#" },
		],
	},
	{
		title: "Dolor",
		links: [
			{ label: "lorem@ipsum.test", href: "mailto:lorem@ipsum.test" },
			{ label: "+00 000 0000", href: "tel:+000000000" },
			{ label: "Lorem ipsum dolor" },
			{ label: "Sit amet consectetur" },
		],
	},
];

const DEFAULT_LEGAL_LINKS = [
	{ label: "Lorem Policy", href: "#" },
	{ label: "Ipsum Terms", href: "#" },
];

function renderColumnItem(item, index) {
	if (item?.href) {
		return React.createElement(
			"li",
			{ key: `${item.label}-${index}` },
			React.createElement(
				"a",
				{ href: item.href, className: linkCls },
				item.label,
			),
		);
	}

	return React.createElement(
		"li",
		{ key: `${item?.label ?? "item"}-${index}`, className: textItemCls },
		item?.label,
	);
}

export function Footer({
	className = "",
	brandName = "Lorem Ipsum Co.",
	brandDescription = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	ctaLabel = "Lorem Ipsum CTA \u2192",
	ctaHref = "#",
	columns = DEFAULT_COLUMNS,
	copyrightText = "\u00a9 2026 Lorem Ipsum Co.",
	legalLinks = DEFAULT_LEGAL_LINKS,
	poweredByText = "Powered by Lorem Ipsum",
	poweredByHref = "#",
	mark,
}) {
	const cols = Array.isArray(columns) ? columns : DEFAULT_COLUMNS;
	const legal = Array.isArray(legalLinks) ? legalLinks : DEFAULT_LEGAL_LINKS;

	return React.createElement(
		"footer",
		{ className: `${footerCls} ${className}`.trim() },
		React.createElement(
			"div",
			{
				className: containerCls,
				style: {
					maxWidth: "var(--footer-container-max-width)",
					paddingLeft: "var(--footer-container-padding-x)",
					paddingRight: "var(--footer-container-padding-x)",
					paddingTop: "var(--footer-container-padding-y)",
					paddingBottom: "var(--footer-container-padding-y)",
				},
			},
			React.createElement(
				"div",
				{ className: topGridCls },
				React.createElement(
					"div",
					{ className: "space-y-5 md:col-span-2 lg:col-span-1" },
					React.createElement(
						"div",
						{ className: brandRowCls },
						mark
							? mark
							: React.createElement(
									"span",
									{
										className: markCls,
										"aria-hidden": "true",
										style: {
											width: "var(--footer-mark-width)",
											height: "var(--footer-mark-height)",
										},
									},
									brandName.charAt(0).toUpperCase(),
								),
						React.createElement("h2", { className: brandNameCls }, brandName),
					),
					React.createElement(
						"p",
						{ className: brandTextCls },
						brandDescription,
					),
					React.createElement(
						"a",
						{
							href: ctaHref,
							className: ctaCls,
							style: {
								paddingLeft: "var(--footer-cta-padding-x)",
								paddingRight: "var(--footer-cta-padding-x)",
								paddingTop: "var(--footer-cta-padding-y)",
								paddingBottom: "var(--footer-cta-padding-y)",
								fontSize: "var(--footer-cta-font-size)",
							},
						},
						ctaLabel,
					),
				),
				...cols.slice(0, 3).map((column, index) =>
					React.createElement(
						"nav",
						{
							key: `${column?.title ?? "column"}-${index}`,
							"aria-label": column?.title ?? `Footer column ${index + 1}`,
							className: "min-w-0",
						},
						React.createElement(
							"h3",
							{
								className: columnTitleCls,
								style: {
									fontSize: "var(--footer-column-title-font-size)",
									textTransform: "var(--footer-column-title-text-transform)",
									letterSpacing: "var(--footer-column-title-text-tracking)",
									fontFamily: "var(--footer-column-title-font-family)",
								},
							},
							column?.title,
						),
						React.createElement(
							"ul",
							{ className: columnListCls },
							...(column?.links ?? []).map(renderColumnItem),
						),
					),
				),
			),
			React.createElement(
				"div",
				{ className: bottomBarCls },
				React.createElement(
					"div",
					{ className: legalCls },
					React.createElement("span", null, copyrightText),
					legal.length > 0
						? React.createElement("span", { className: sepCls }, "\u2022")
						: null,
					...legal.flatMap((item, index) => {
						const node = item?.href
							? React.createElement(
									"a",
									{ href: item.href, className: linkCls },
									item.label,
								)
							: React.createElement("span", null, item?.label);

						if (index === legal.length - 1) {
							return [
								React.createElement("span", { key: `legal-${index}` }, node),
							];
						}

						return [
							React.createElement("span", { key: `legal-${index}` }, node),
							React.createElement(
								"span",
								{ key: `sep-${index}`, className: sepCls },
								"\u2022",
							),
						];
					}),
				),
				poweredByHref
					? React.createElement(
							"a",
							{
								href: poweredByHref,
								className: `${linkCls} lg:text-right`.trim(),
							},
							poweredByText,
						)
					: React.createElement(
							"p",
							{ className: "lg:text-right" },
							poweredByText,
						),
			),
		),
	);
}
