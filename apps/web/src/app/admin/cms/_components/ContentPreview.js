"use client";

import { useState } from "react";
import PageContentRenderer, {
	pageHasRenderableContent,
} from "@/app/_components/PageContentRenderer";

/**
 * Collapsible live preview panel for CMS content body.
 *
 * @param {{
 *   title?: string,
 *   excerpt?: string,
 *   layout?: string,
 *   content?: unknown,
 *   body?: string
 * }} props
 */
export default function ContentPreview({
	title,
	excerpt,
	layout,
	content,
	body,
}) {
	const [open, setOpen] = useState(true);
	const hasPagePreview = pageHasRenderableContent(content, body);
	const hasTextPreview = body?.trim();

	return (
		<div className="rounded-[--radius-default] border border-border bg-surface overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-hover transition-colors"
			>
				<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
					Preview
				</p>
				<svg
					aria-hidden="true"
					className={`w-3.5 h-3.5 text-text-faint transition-transform duration-150 ${open ? "rotate-180" : ""}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth="2"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>

			{open && (
				<div className="border-t border-border">
					{hasPagePreview ? (
						<div className="max-h-152 overflow-y-auto bg-bg">
							<PageContentRenderer
								title={title}
								excerpt={excerpt}
								layout={layout}
								content={content}
								fallbackBody={body}
								previewMode
							/>
						</div>
					) : hasTextPreview ? (
						<div className="max-h-120 overflow-y-auto bg-bg px-4 py-6 text-sm leading-7 text-text-muted whitespace-pre-wrap">
							{body}
						</div>
					) : (
						<p className="px-4 py-6 text-xs text-text-faint text-center">
							Nothing to preview yet — add a section to see the page come
							together.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
