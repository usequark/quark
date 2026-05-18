import { normalizePageContent } from "../../lib/content/page-content.js";

function hasRenderableContent(blocks) {
	return blocks.some((block) => {
		switch (block?.type) {
			case "richText":
				return stripHtml(block.html ?? "").trim().length > 0;
			case "image":
				return Boolean(block.src);
			case "mediaText":
				return Boolean(block.src || block.eyebrow || block.title || block.body);
			case "cta":
				return Boolean(
					block.eyebrow ||
						block.title ||
						block.body ||
						(block.buttonLabel && block.buttonHref),
				);
			default:
				return false;
		}
	});
}

const LAYOUT_CLASSES = {
	standard: "max-w-5xl",
	narrow: "max-w-3xl",
	immersive: "max-w-6xl",
};

export function pageHasRenderableContent(content, fallbackBody = "") {
	return hasRenderableContent(normalizePageContent(content, fallbackBody));
}

export default function PageContentRenderer({
	title,
	excerpt,
	content,
	fallbackBody = "",
	layout = "standard",
	previewMode = false,
}) {
	const blocks = normalizePageContent(content, fallbackBody);
	const hasContent = hasRenderableContent(blocks);
	const layoutClass = LAYOUT_CLASSES[layout] ?? LAYOUT_CLASSES.standard;

	if (!title && !excerpt && !hasContent) {
		return (
			<div className="rounded-[--radius-default] border border-dashed border-border px-6 py-10 text-center text-sm text-text-faint">
				Add a title and at least one section to preview the page.
			</div>
		);
	}

	return (
		<article className="bg-bg text-text">
			<div
				className={`mx-auto w-full ${layoutClass} px-5 py-8 sm:px-8 sm:py-12`}
			>
				{(title || excerpt) && (
					<header className="border-b border-border pb-6">
						{title && (
							<h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">
								{title}
							</h1>
						)}
						{excerpt && (
							<p className="mt-3 max-w-2xl text-base leading-7 text-text-muted sm:text-lg">
								{excerpt}
							</p>
						)}
					</header>
				)}

				<div className="space-y-10 pt-6 sm:space-y-14 sm:pt-8">
					{blocks.map((block) => (
						<PageBlock
							key={block.id ?? `${block.type}-${JSON.stringify(block)}`}
							block={block}
							previewMode={previewMode}
						/>
					))}
				</div>
			</div>
		</article>
	);
}

function PageBlock({ block, previewMode }) {
	switch (block?.type) {
		case "richText":
			if (!stripHtml(block.html ?? "").trim()) return null;
			return (
				<section className="prose-like max-w-none text-text">
					<div
						className="space-y-4 text-base leading-7 text-text [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-muted [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-[--radius-default] [&_pre]:border [&_pre]:border-border [&_pre]:bg-surface [&_pre]:p-4 [&_ul]:list-disc [&_ul]:pl-5"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: rich text HTML is sanitized before persistence
						dangerouslySetInnerHTML={{ __html: block.html ?? "" }}
					/>
				</section>
			);
		case "image":
			if (!block.src) return null;
			return (
				<section className={imageSectionClass(block.width)}>
					<figure className="overflow-hidden rounded-[--radius-default] border border-border bg-surface shadow-[0_12px_40px_rgba(15,23,42,0.12)]">
						{/* biome-ignore lint/performance/noImgElement: image sources may be local media routes or external URLs */}
						<img
							src={block.src}
							alt={block.alt || ""}
							className="block h-auto w-full object-cover"
						/>
						{block.caption && (
							<figcaption className="border-t border-border px-4 py-3 text-sm text-text-muted">
								{block.caption}
							</figcaption>
						)}
					</figure>
				</section>
			);
		case "mediaText":
			if (!block.src && !block.eyebrow && !block.title && !block.body)
				return null;
			return (
				<section className="grid gap-6 rounded-[--radius-default] border border-border bg-surface p-5 sm:p-6 lg:grid-cols-2 lg:items-center lg:gap-10">
					<div className={block.mediaPosition === "right" ? "lg:order-2" : ""}>
						{block.src ? (
							<div className="overflow-hidden rounded-[--radius-default] border border-border bg-surface-hover">
								{/* biome-ignore lint/performance/noImgElement: image sources may be local media routes or external URLs */}
								<img
									src={block.src}
									alt={block.alt || ""}
									className="block h-full w-full object-cover"
								/>
							</div>
						) : (
							<div className="flex min-h-56 items-center justify-center rounded-[--radius-default] border border-dashed border-border bg-bg text-sm text-text-faint">
								Add media to this section.
							</div>
						)}
					</div>
					<div className={block.mediaPosition === "right" ? "lg:order-1" : ""}>
						{block.eyebrow && (
							<p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-faint">
								{block.eyebrow}
							</p>
						)}
						{block.title && (
							<h2 className="mt-2 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
								{block.title}
							</h2>
						)}
						{block.body && (
							<p className="mt-4 whitespace-pre-line text-base leading-7 text-text-muted">
								{block.body}
							</p>
						)}
					</div>
				</section>
			);
		case "cta":
			if (
				!block.eyebrow &&
				!block.title &&
				!block.body &&
				!(block.buttonLabel && block.buttonHref)
			) {
				return null;
			}
			return (
				<section className="rounded-[--radius-default] border border-border bg-[linear-gradient(135deg,var(--surface),rgba(20,32,54,0.96))] px-5 py-6 shadow-[0_12px_32px_rgba(15,23,42,0.18)] sm:px-6 sm:py-7">
					<div className="max-w-3xl">
						{block.eyebrow && (
							<p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-faint">
								{block.eyebrow}
							</p>
						)}
						{block.title && (
							<h2 className="mt-2 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
								{block.title}
							</h2>
						)}
						{block.body && (
							<p className="mt-3 whitespace-pre-line text-base leading-7 text-text-muted">
								{block.body}
							</p>
						)}
						{block.buttonLabel && block.buttonHref && (
							<div className="mt-5">
								{previewMode ? (
									<span className="inline-flex h-11 items-center justify-center rounded-[--radius-default] border border-primary/40 bg-primary px-5 text-sm font-medium text-white">
										{block.buttonLabel}
									</span>
								) : (
									<a
										href={block.buttonHref}
										className="inline-flex h-11 items-center justify-center rounded-[--radius-default] border border-primary/40 bg-primary px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
									>
										{block.buttonLabel}
									</a>
								)}
							</div>
						)}
					</div>
				</section>
			);
		default:
			return null;
	}
}

function imageSectionClass(width = "content") {
	if (width === "full") return "-mx-5 sm:-mx-8";
	if (width === "wide") return "sm:-mx-4";
	return "";
}

function stripHtml(value) {
	return String(value ?? "")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
}
