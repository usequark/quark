"use client";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

const GRID_COLUMNS = {
	1: "grid-cols-1",
	2: "grid-cols-1 sm:grid-cols-2",
	3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
	4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
};

const THUMBNAIL_FIGURE_CLASS =
	"overflow-hidden rounded-[--radius-default] border border-border bg-surface shadow-sm";

const THUMBNAIL_BUTTON_CLASS =
	"overflow-hidden rounded-[--radius-default] border border-border bg-surface text-left shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-hover cursor-pointer";

const LIGHTBOX_ANIMATION_MS = 220;

function normalizeImage(image, index) {
	if (typeof image === "string") {
		return {
			src: image,
			thumbnailSrc: image,
			alt: `Gallery image ${index + 1}`,
			caption: "",
		};
	}

	if (!image || typeof image !== "object") {
		return null;
	}

	const src = image.src || "";
	if (!src) {
		return null;
	}

	return {
		src,
		thumbnailSrc: image.thumbnailSrc || src,
		alt: image.alt || `Gallery image ${index + 1}`,
		caption: image.caption || "",
	};
}

export function PhotoGallery({
	images = [],
	columns = 3,
	className = "",
	thumbnailClassName = "",
	lightbox = true,
	showCounter = true,
}) {
	const normalizedImages = useMemo(() => {
		if (!Array.isArray(images)) return [];
		return images.map(normalizeImage).filter(Boolean);
	}, [images]);

	const totalImages = normalizedImages.length;
	const [activeIndex, setActiveIndex] = useState(-1);
	const [isClosing, setIsClosing] = useState(false);
	const [isLightboxVisible, setIsLightboxVisible] = useState(false);
	const closeButtonRef = useRef(null);
	const closeTimerRef = useRef(null);
	const openFrameRef = useRef(null);

	const canNavigate = totalImages > 1;
	const activeImage = activeIndex >= 0 ? normalizedImages[activeIndex] : null;

	useEffect(() => {
		return () => {
			if (closeTimerRef.current !== null) {
				window.clearTimeout(closeTimerRef.current);
				closeTimerRef.current = null;
			}

			if (openFrameRef.current !== null) {
				window.cancelAnimationFrame(openFrameRef.current);
				openFrameRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (activeIndex < 0) return;
		if (activeIndex < totalImages) return;
		setActiveIndex(totalImages > 0 ? totalImages - 1 : -1);
	}, [activeIndex, totalImages]);

	const closeLightbox = useCallback(() => {
		if (activeIndex < 0 || isClosing) return;

		setIsClosing(true);
		setIsLightboxVisible(false);

		if (closeTimerRef.current !== null) {
			window.clearTimeout(closeTimerRef.current);
		}

		closeTimerRef.current = window.setTimeout(() => {
			setActiveIndex(-1);
			setIsClosing(false);
			closeTimerRef.current = null;
		}, LIGHTBOX_ANIMATION_MS);
	}, [activeIndex, isClosing]);

	const openLightbox = useCallback(
		(index) => {
			if (!lightbox) return;

			if (closeTimerRef.current !== null) {
				window.clearTimeout(closeTimerRef.current);
				closeTimerRef.current = null;
			}

			setIsClosing(false);
			setActiveIndex(index);
		},
		[lightbox],
	);

	const goToPrevious = useCallback(() => {
		if (!canNavigate) return;
		setActiveIndex((currentIndex) =>
			currentIndex <= 0 ? totalImages - 1 : currentIndex - 1,
		);
	}, [canNavigate, totalImages]);

	const goToNext = useCallback(() => {
		if (!canNavigate) return;
		setActiveIndex((currentIndex) =>
			currentIndex >= totalImages - 1 ? 0 : currentIndex + 1,
		);
	}, [canNavigate, totalImages]);

	useEffect(() => {
		if (activeIndex < 0) return;

		function handleKeyDown(event) {
			if (event.key === "Escape") {
				event.preventDefault();
				closeLightbox();
				return;
			}

			if (event.key === "ArrowLeft") {
				event.preventDefault();
				goToPrevious();
				return;
			}

			if (event.key === "ArrowRight") {
				event.preventDefault();
				goToNext();
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [activeIndex, closeLightbox, goToNext, goToPrevious]);

	useEffect(() => {
		if (activeIndex < 0) return;
		if (isClosing) return;

		setIsLightboxVisible(false);

		openFrameRef.current = window.requestAnimationFrame(() => {
			setIsLightboxVisible(true);
			openFrameRef.current = null;
		});

		return () => {
			if (openFrameRef.current !== null) {
				window.cancelAnimationFrame(openFrameRef.current);
				openFrameRef.current = null;
			}
		};
	}, [activeIndex, isClosing]);

	useEffect(() => {
		if (activeIndex < 0) {
			setIsLightboxVisible(false);
		}
	}, [activeIndex]);

	useEffect(() => {
		if (activeIndex < 0) return;
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, [activeIndex]);

	useEffect(() => {
		if (activeIndex < 0 || !isLightboxVisible) return;
		closeButtonRef.current?.focus();
	}, [activeIndex, isLightboxVisible]);

	const gridColumnClass = GRID_COLUMNS[columns] || GRID_COLUMNS[3];

	if (totalImages === 0) {
		return React.createElement(
			"div",
			{
				className:
					`rounded-[--radius-default] border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted ${className}`.trim(),
			},
			"No images to display.",
		);
	}

	const thumbnailElements = normalizedImages.map((image, index) => {
		const content = React.createElement(
			React.Fragment,
			null,
			React.createElement(
				"div",
				{
					className:
						"flex min-h-[10rem] max-h-[22rem] items-center justify-center overflow-hidden rounded-t-[--radius-default] bg-bg p-2",
				},
				React.createElement("img", {
					src: image.thumbnailSrc,
					alt: image.alt,
					loading: "lazy",
					className: "max-h-[20rem] w-full object-contain",
				}),
			),
			image.caption
				? React.createElement(
						"p",
						{
							className:
								"border-t border-border px-3 py-2 text-sm leading-5 text-text-muted",
						},
						image.caption,
					)
				: null,
		);

		if (!lightbox) {
			return React.createElement(
				"figure",
				{
					key: `${image.src}-${index}`,
					className: thumbnailClassName
						? `${THUMBNAIL_FIGURE_CLASS} ${thumbnailClassName}`
						: THUMBNAIL_FIGURE_CLASS,
				},
				content,
			);
		}

		return React.createElement(
			"button",
			{
				type: "button",
				key: `${image.src}-${index}`,
				onClick: () => openLightbox(index),
				className: thumbnailClassName
					? `${THUMBNAIL_BUTTON_CLASS} ${thumbnailClassName}`
					: THUMBNAIL_BUTTON_CLASS,
				"aria-label": `Open image ${index + 1} of ${totalImages}`,
			},
			content,
		);
	});

	const lightboxElement = activeImage
		? React.createElement(
				"div",
				{
					className: `fixed inset-0 z-[90] bg-black/80 px-3 py-4 transition-opacity duration-200 ease-out sm:px-6 sm:py-8 ${isLightboxVisible ? "opacity-100" : "opacity-0"}`,
					onClick: closeLightbox,
				},
				React.createElement(
					"div",
					{
						role: "dialog",
						"aria-modal": "true",
						"aria-label": "Image lightbox",
						className: `mx-auto flex h-full w-full max-w-6xl flex-col p-3 transition-all duration-200 ease-out sm:p-5 ${isLightboxVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`,
						onClick: (event) => event.stopPropagation(),
					},
					React.createElement(
						"div",
						{ className: "mb-3 flex items-center justify-between gap-3" },
						React.createElement("span", null),
						React.createElement(
							"button",
							{
								type: "button",
								ref: closeButtonRef,
								onClick: closeLightbox,
								className:
									"rounded-[--radius-default] border border-white/25 px-3 py-1 text-sm font-medium text-white transition-colors duration-200 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 flex items-center cursor-pointer",
							},
							"X",
						),
					),
					React.createElement(
						"div",
						{ className: "flex min-h-0 flex-1 items-center justify-center" },
						React.createElement("img", {
							src: activeImage.src,
							alt: activeImage.alt,
							className: `max-h-[72vh] w-auto max-w-full rounded-[--radius-default] object-contain transition-all duration-200 ease-out ${isLightboxVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`,
						}),
					),
					activeImage.caption
						? React.createElement(
								"p",
								{ className: "mt-3 text-sm leading-6 text-white/85" },
								activeImage.caption,
							)
						: null,
					canNavigate
						? React.createElement(
								"div",
								{ className: "mt-4 flex items-center justify-center gap-2" },
								React.createElement(
									"button",
									{
										type: "button",
										onClick: goToPrevious,
										className:
											"rounded-[--radius-default] border border-white/25 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer",
									},
									"Previous",
								),
								showCounter
									? React.createElement(
											"p",
											{
												className:
													"min-w-16 text-center font-mono text-xs uppercase tracking-[0.16em] text-white/80",
											},
											`${activeIndex + 1} / ${totalImages}`,
										)
									: null,
								React.createElement(
									"button",
									{
										type: "button",
										onClick: goToNext,
										className:
											"rounded-[--radius-default] border border-white/25 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer",
									},
									"Next",
								),
							)
						: null,
				),
			)
		: null;

	return React.createElement(
		"div",
		{ className: `space-y-3 ${className}`.trim() },
		React.createElement(
			"div",
			{ className: `grid gap-3 ${gridColumnClass}` },
			thumbnailElements,
		),
		lightboxElement,
	);
}

export { PhotoGallery as ImageGallery };
