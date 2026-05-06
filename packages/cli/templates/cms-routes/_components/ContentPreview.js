"use client";

import { useState } from "react";

/**
 * Collapsible live preview panel for CMS content body.
 * Renders the raw body string as HTML in a sandboxed iframe so injected
 * scripts cannot escape the preview context.
 *
 * @param {{ body: string }} props
 */
export default function ContentPreview({ body }) {
	const [open, setOpen] = useState(false);

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
					{body?.trim() ? (
						<iframe
							title="Content preview"
							sandbox="allow-same-origin"
							className="w-full min-h-48 max-h-120 border-0"
							srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>
								*{box-sizing:border-box;margin:0;padding:0}
								body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.7;color:#111;padding:16px;word-break:break-word}
								h1,h2,h3,h4{font-weight:600;line-height:1.3;margin:1em 0 .4em}
								h1{font-size:1.5em}h2{font-size:1.25em}h3{font-size:1.1em}
								p{margin:.6em 0}
								a{color:#2563eb}
								ul,ol{padding-left:1.4em;margin:.6em 0}
								li{margin:.2em 0}
								pre,code{font-family:monospace;background:#f3f4f6;border-radius:4px;padding:.15em .35em;font-size:.9em}
								pre{padding:.75em 1em;overflow:auto}
								pre code{background:none;padding:0}
								blockquote{border-left:3px solid #d1d5db;padding-left:.9em;color:#555;margin:.6em 0}
								img{max-width:100%;border-radius:4px}
								table{border-collapse:collapse;width:100%;margin:.6em 0}
								th,td{border:1px solid #e5e7eb;padding:.4em .7em;text-align:left}
								th{background:#f9fafb;font-weight:600}
								hr{border:none;border-top:1px solid #e5e7eb;margin:1em 0}
							</style></head><body>${body}</body></html>`}
						/>
					) : (
						<p className="px-4 py-6 text-xs text-text-faint text-center">
							Nothing to preview yet — start writing in the Body field.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
