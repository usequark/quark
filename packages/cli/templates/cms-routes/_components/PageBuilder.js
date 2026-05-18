"use client";

import {
	createPageBlock,
	normalizePageContent,
	PAGE_BLOCK_TYPES,
	PAGE_LAYOUTS,
} from "@techstream/quark-cms/page-builder";
import {
	Button,
	Input,
	Label,
	RichText,
	Select,
	Textarea,
} from "@techstream/quark-ui";
import { useEffect, useMemo, useState } from "react";
import CoverImageField from "./CoverImageField";

export default function PageBuilder({
	defaultContent,
	defaultBody = "",
	defaultLayout = "standard",
	onContentChange,
	onLayoutChange,
}) {
	const [blocks, setBlocks] = useState(() =>
		normalizePageContent(defaultContent, defaultBody),
	);
	const [layout, setLayout] = useState(defaultLayout || "standard");

	useEffect(() => {
		onContentChange?.(blocks);
	}, [blocks, onContentChange]);

	useEffect(() => {
		onLayoutChange?.(layout);
	}, [layout, onLayoutChange]);

	const serializedContent = useMemo(() => JSON.stringify(blocks), [blocks]);

	function updateBlock(id, updater) {
		setBlocks((currentBlocks) => {
			let changed = false;
			const nextBlocks = currentBlocks.map((block) => {
				if (block.id !== id) return block;
				const patch = typeof updater === "function" ? updater(block) : updater;
				if (!patch) return block;

				const hasChanges = Object.entries(patch).some(
					([key, value]) => block[key] !== value,
				);
				if (!hasChanges) {
					return block;
				}

				changed = true;
				return { ...block, ...patch };
			});

			return changed ? nextBlocks : currentBlocks;
		});
	}

	function addBlock(type) {
		setBlocks((currentBlocks) => [...currentBlocks, createPageBlock(type)]);
	}

	function removeBlock(id) {
		setBlocks((currentBlocks) => {
			if (currentBlocks.length === 1) {
				return [createPageBlock("richText")];
			}

			return currentBlocks.filter((block) => block.id !== id);
		});
	}

	function moveBlock(id, direction) {
		setBlocks((currentBlocks) => {
			const index = currentBlocks.findIndex((block) => block.id === id);
			if (index === -1) return currentBlocks;

			const nextIndex = index + direction;
			if (nextIndex < 0 || nextIndex >= currentBlocks.length) {
				return currentBlocks;
			}

			const reordered = [...currentBlocks];
			const [movedBlock] = reordered.splice(index, 1);
			reordered.splice(nextIndex, 0, movedBlock);
			return reordered;
		});
	}

	const activeLayout = PAGE_LAYOUTS.find(
		(candidate) => candidate.value === layout,
	);

	return (
		<div className="space-y-5">
			<input type="hidden" name="content" value={serializedContent} />
			<input type="hidden" name="layout" value={layout} />

			<div className="rounded-[--radius-default] border border-border bg-surface p-4">
				<div className="mb-4 border-b border-border pb-3">
					<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
						Layout
					</h2>
					<p className="mt-1 text-sm text-text-faint">
						Choose how sections are arranged on the public page.
					</p>
				</div>
				<div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
					<div className="flex flex-col gap-1">
						<Label htmlFor="page-layout">Page layout</Label>
						<Select
							id="page-layout"
							aria-describedby="page-layout-description"
							value={layout}
							onChange={(event) => setLayout(event.target.value)}
						>
							{PAGE_LAYOUTS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</Select>
					</div>
					<p
						id="page-layout-description"
						className="text-sm leading-6 text-text-muted"
					>
						{activeLayout?.description}
					</p>
				</div>
			</div>

			<div className="space-y-4">
				{blocks.map((block, index) => {
					const blockMeta = PAGE_BLOCK_TYPES.find(
						(candidate) => candidate.value === block.type,
					);

					return (
						<section
							key={block.id}
							className="rounded-[--radius-default] border border-border bg-surface"
						>
							<div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-faint">
										Section {index + 1}
									</p>
									<h3 className="mt-1 text-base font-medium text-text">
										{blockMeta?.label}
									</h3>
									<p className="mt-1 text-sm text-text-muted">
										{blockMeta?.description}
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Button
										type="button"
										variant="secondary"
										onClick={() => moveBlock(block.id, -1)}
										disabled={index === 0}
										className="h-8 px-3 text-xs"
									>
										Move Up
									</Button>
									<Button
										type="button"
										variant="secondary"
										onClick={() => moveBlock(block.id, 1)}
										disabled={index === blocks.length - 1}
										className="h-8 px-3 text-xs"
									>
										Move Down
									</Button>
									<Button
										type="button"
										variant="danger"
										onClick={() => removeBlock(block.id)}
										className="h-8 px-3 text-xs"
									>
										Remove
									</Button>
								</div>
							</div>

							<div className="px-4 py-4">
								<BlockFields block={block} updateBlock={updateBlock} />
							</div>
						</section>
					);
				})}
			</div>

			<div className="rounded-[--radius-default] border border-dashed border-border bg-surface px-4 py-4">
				<div className="mb-4 border-b border-border pb-3">
					<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
						Add Section
					</h2>
					<p className="mt-1 text-sm text-text-faint">
						Insert a new content block into this page.
					</p>
				</div>
				<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					{PAGE_BLOCK_TYPES.map((blockType) => (
						<Button
							key={blockType.value}
							type="button"
							variant="secondary"
							onClick={() => addBlock(blockType.value)}
							className="justify-start"
						>
							{blockType.label}
						</Button>
					))}
				</div>
			</div>
		</div>
	);
}

function BlockFields({ block, updateBlock }) {
	switch (block.type) {
		case "richText":
			return (
				<div className="flex flex-col gap-1">
					<Label htmlFor={`block-${block.id}-html`}>Rich text</Label>
					<RichText
						id={`block-${block.id}-html`}
						defaultValue={block.html}
						rows={10}
						placeholder="Add the main narrative, details, or supporting copy for this page section."
						onChange={(html) => updateBlock(block.id, { html })}
					/>
				</div>
			);
		case "image":
			return (
				<div className="space-y-4">
					<CoverImageField
						label="Image"
						name=""
						defaultValue={block.src}
						onChange={(src) => updateBlock(block.id, { src })}
					/>
					<div className="grid gap-4 lg:grid-cols-2">
						<div className="flex flex-col gap-1">
							<Label htmlFor={`block-${block.id}-alt`}>Alt text</Label>
							<Input
								id={`block-${block.id}-alt`}
								value={block.alt}
								onChange={(event) =>
									updateBlock(block.id, { alt: event.target.value })
								}
								placeholder="Describe the image for accessibility"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor={`block-${block.id}-width`}>Width</Label>
							<Select
								id={`block-${block.id}-width`}
								value={block.width}
								onChange={(event) =>
									updateBlock(block.id, { width: event.target.value })
								}
							>
								<option value="content">Content width</option>
								<option value="wide">Wide</option>
								<option value="full">Full bleed</option>
							</Select>
						</div>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor={`block-${block.id}-caption`}>Caption</Label>
						<Textarea
							id={`block-${block.id}-caption`}
							rows={3}
							value={block.caption}
							onChange={(event) =>
								updateBlock(block.id, { caption: event.target.value })
							}
							placeholder="Optional context shown beneath the image"
						/>
					</div>
				</div>
			);
		case "mediaText":
			return (
				<div className="space-y-4">
					<CoverImageField
						label="Media"
						name=""
						defaultValue={block.src}
						onChange={(src) => updateBlock(block.id, { src })}
					/>
					<div className="grid gap-4 lg:grid-cols-2">
						<div className="flex flex-col gap-1">
							<Label htmlFor={`block-${block.id}-media-position`}>
								Media position
							</Label>
							<Select
								id={`block-${block.id}-media-position`}
								value={block.mediaPosition}
								onChange={(event) =>
									updateBlock(block.id, {
										mediaPosition: event.target.value,
									})
								}
							>
								<option value="left">Media on left</option>
								<option value="right">Media on right</option>
							</Select>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor={`block-${block.id}-alt`}>Alt text</Label>
							<Input
								id={`block-${block.id}-alt`}
								value={block.alt}
								onChange={(event) =>
									updateBlock(block.id, { alt: event.target.value })
								}
								placeholder="Describe the media if it adds meaning"
							/>
						</div>
					</div>
					<div className="grid gap-4 lg:grid-cols-2">
						<div className="flex flex-col gap-1">
							<Label htmlFor={`block-${block.id}-eyebrow`}>Eyebrow</Label>
							<Input
								id={`block-${block.id}-eyebrow`}
								value={block.eyebrow}
								onChange={(event) =>
									updateBlock(block.id, { eyebrow: event.target.value })
								}
								placeholder="Optional section kicker"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor={`block-${block.id}-title`}>Title</Label>
							<Input
								id={`block-${block.id}-title`}
								value={block.title}
								onChange={(event) =>
									updateBlock(block.id, { title: event.target.value })
								}
								placeholder="Section headline"
							/>
						</div>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor={`block-${block.id}-body`}>Body</Label>
						<Textarea
							id={`block-${block.id}-body`}
							rows={5}
							value={block.body}
							onChange={(event) =>
								updateBlock(block.id, { body: event.target.value })
							}
							placeholder="Supporting copy for the paired media section"
						/>
					</div>
				</div>
			);
		case "cta":
			return (
				<div className="space-y-4">
					<div className="grid gap-4 lg:grid-cols-2">
						<div className="flex flex-col gap-1">
							<Label htmlFor={`block-${block.id}-eyebrow`}>Eyebrow</Label>
							<Input
								id={`block-${block.id}-eyebrow`}
								value={block.eyebrow}
								onChange={(event) =>
									updateBlock(block.id, { eyebrow: event.target.value })
								}
								placeholder="Optional kicker"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor={`block-${block.id}-title`}>Title</Label>
							<Input
								id={`block-${block.id}-title`}
								value={block.title}
								onChange={(event) =>
									updateBlock(block.id, { title: event.target.value })
								}
								placeholder="Prompt the next action"
							/>
						</div>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor={`block-${block.id}-body`}>Body</Label>
						<Textarea
							id={`block-${block.id}-body`}
							rows={4}
							value={block.body}
							onChange={(event) =>
								updateBlock(block.id, { body: event.target.value })
							}
							placeholder="Tell the reader why they should act now"
						/>
					</div>
					<div className="grid gap-4 lg:grid-cols-2">
						<div className="flex flex-col gap-1">
							<Label htmlFor={`block-${block.id}-button-label`}>
								Button label
							</Label>
							<Input
								id={`block-${block.id}-button-label`}
								value={block.buttonLabel}
								onChange={(event) =>
									updateBlock(block.id, { buttonLabel: event.target.value })
								}
								placeholder="Contact sales"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor={`block-${block.id}-button-href`}>
								Button link
							</Label>
							<Input
								id={`block-${block.id}-button-href`}
								value={block.buttonHref}
								onChange={(event) =>
									updateBlock(block.id, { buttonHref: event.target.value })
								}
								placeholder="/contact or https://example.com/demo"
							/>
						</div>
					</div>
				</div>
			);
		default:
			return null;
	}
}
