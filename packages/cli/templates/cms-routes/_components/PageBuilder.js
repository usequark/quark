"use client";

import {
	createPageBlock,
	normalizePageContent,
	PAGE_BACKGROUND_ANIMATIONS,
	PAGE_BACKGROUND_MODES,
	PAGE_BACKGROUND_TONES,
	PAGE_BLOCK_TYPES,
	PAGE_LAYOUTS,
} from "@techstream/quark-cms/page-builder";
import { Button, Input, Label, RichText, Select } from "@techstream/quark-ui";
import { useEffect, useMemo, useState } from "react";
import CoverImageField from "./CoverImageField";

const DEFAULT_COLOR_BACKGROUND = "primary";
const DEFAULT_ANIMATION_BACKGROUND =
	PAGE_BACKGROUND_ANIMATIONS[0]?.value ?? "background-aurora";
const DEFAULT_ANIMATION_TONE = "primary";

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
				return [createPageBlock("default")];
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
				<Label htmlFor="page-layout">Layout</Label>
				<div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
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
									<button
										type="button"
										onClick={() => moveBlock(block.id, -1)}
										disabled={index === 0}
										className="rounded-[--radius-default] border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-border-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
									>
										Move Up
									</button>
									<button
										type="button"
										onClick={() => moveBlock(block.id, 1)}
										disabled={index === blocks.length - 1}
										className="rounded-[--radius-default] border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-border-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
									>
										Move Down
									</button>
									<button
										type="button"
										onClick={() => removeBlock(block.id)}
										className="rounded-[--radius-default] border border-danger/40 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10"
									>
										Remove
									</button>
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
				<p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-faint">
					Add Section
				</p>
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
		case "hero":
			return (
				<div className="space-y-4">
					<div className="grid gap-4 lg:grid-cols-2">
						<TextField
							id={`block-${block.id}-eyebrow`}
							label="Eyebrow"
							value={block.eyebrow}
							placeholder="Optional short kicker"
							onChange={(value) => updateBlock(block.id, { eyebrow: value })}
						/>
						<TextField
							id={`block-${block.id}-title`}
							label="Title"
							value={block.title}
							placeholder="Hero headline"
							onChange={(value) => updateBlock(block.id, { title: value })}
						/>
					</div>
					<RichTextField
						id={`block-${block.id}-subtitle`}
						label="Subtitle"
						value={block.subtitle}
						rows={4}
						placeholder="Supporting hero copy"
						onChange={(value) => updateBlock(block.id, { subtitle: value })}
					/>
					<BackgroundFields block={block} updateBlock={updateBlock} />
				</div>
			);
		case "default":
			return (
				<div className="space-y-4">
					<div className="grid gap-4 lg:grid-cols-2">
						<TextField
							id={`block-${block.id}-eyebrow`}
							label="Eyebrow"
							value={block.eyebrow}
							placeholder="Optional short kicker"
							onChange={(value) => updateBlock(block.id, { eyebrow: value })}
						/>
						<TextField
							id={`block-${block.id}-title`}
							label="Title"
							value={block.title}
							placeholder="Section title"
							onChange={(value) => updateBlock(block.id, { title: value })}
						/>
					</div>
					<RichTextField
						id={`block-${block.id}-body`}
						label="Body"
						value={block.body}
						rows={6}
						placeholder="Main section content"
						onChange={(value) => updateBlock(block.id, { body: value })}
					/>
				</div>
			);
		case "split":
			return (
				<div className="space-y-4">
					<div className="grid gap-4 lg:grid-cols-2">
						<TextField
							id={`block-${block.id}-eyebrow`}
							label="Eyebrow"
							value={block.eyebrow}
							placeholder="Optional short kicker"
							onChange={(value) => updateBlock(block.id, { eyebrow: value })}
						/>
						<TextField
							id={`block-${block.id}-title`}
							label="Title"
							value={block.title}
							placeholder="Split section headline"
							onChange={(value) => updateBlock(block.id, { title: value })}
						/>
					</div>
					<div className="grid gap-4 xl:grid-cols-2">
						<SplitColumnFields
							side="Left"
							block={block}
							kindField="leftKind"
							bodyField="leftBody"
							srcField="leftSrc"
							altField="leftAlt"
							updateBlock={updateBlock}
						/>
						<SplitColumnFields
							side="Right"
							block={block}
							kindField="rightKind"
							bodyField="rightBody"
							srcField="rightSrc"
							altField="rightAlt"
							updateBlock={updateBlock}
						/>
					</div>
				</div>
			);
		case "cta":
			return (
				<div className="space-y-4">
					<div className="grid gap-4 lg:grid-cols-2">
						<TextField
							id={`block-${block.id}-title`}
							label="Title"
							value={block.title}
							placeholder="Prompt the next action"
							onChange={(value) => updateBlock(block.id, { title: value })}
						/>
						<RichTextField
							id={`block-${block.id}-subtitle`}
							label="Subtitle"
							value={block.subtitle}
							rows={2}
							placeholder="Support the CTA message"
							onChange={(value) => updateBlock(block.id, { subtitle: value })}
						/>
					</div>
					<div className="grid gap-4 lg:grid-cols-2">
						<TextField
							id={`block-${block.id}-primary-label`}
							label="Primary button label"
							value={block.primaryLabel}
							placeholder="Get started"
							onChange={(value) =>
								updateBlock(block.id, { primaryLabel: value })
							}
						/>
						<TextField
							id={`block-${block.id}-primary-href`}
							label="Primary button link"
							value={block.primaryHref}
							placeholder="/contact or https://example.com/demo"
							onChange={(value) =>
								updateBlock(block.id, { primaryHref: value })
							}
						/>
					</div>
					<div className="grid gap-4 lg:grid-cols-2">
						<TextField
							id={`block-${block.id}-secondary-label`}
							label="Secondary button label"
							value={block.secondaryLabel}
							placeholder="View docs"
							onChange={(value) =>
								updateBlock(block.id, { secondaryLabel: value })
							}
						/>
						<TextField
							id={`block-${block.id}-secondary-href`}
							label="Secondary button link"
							value={block.secondaryHref}
							placeholder="/docs or https://example.com/docs"
							onChange={(value) =>
								updateBlock(block.id, { secondaryHref: value })
							}
						/>
					</div>
					<BackgroundFields block={block} updateBlock={updateBlock} />
				</div>
			);
		default:
			return null;
	}
}

function SplitColumnFields({
	side,
	block,
	kindField,
	bodyField,
	srcField,
	altField,
	updateBlock,
}) {
	const kind = block[kindField];

	return (
		<div className="rounded-[--radius-default] border border-border bg-bg/50 p-4 space-y-4">
			<div className="flex flex-col gap-1">
				<Label htmlFor={`block-${block.id}-${kindField}`}>
					{side} column type
				</Label>
				<Select
					id={`block-${block.id}-${kindField}`}
					value={kind}
					onChange={(event) =>
						updateBlock(block.id, { [kindField]: event.target.value })
					}
				>
					<option value="text">Text</option>
					<option value="image">Image</option>
				</Select>
			</div>

			{kind === "image" ? (
				<>
					<CoverImageField
						label={`${side} image`}
						name=""
						defaultValue={block[srcField]}
						onChange={(src) => updateBlock(block.id, { [srcField]: src })}
					/>
					<TextField
						id={`block-${block.id}-${altField}`}
						label={`${side} image alt text`}
						value={block[altField]}
						placeholder={`Describe the ${side.toLowerCase()} image`}
						onChange={(value) => updateBlock(block.id, { [altField]: value })}
					/>
				</>
			) : (
				<RichTextField
					id={`block-${block.id}-${bodyField}`}
					label={`${side} text`}
					value={block[bodyField]}
					rows={5}
					placeholder={`Add ${side.toLowerCase()} column copy`}
					onChange={(value) => updateBlock(block.id, { [bodyField]: value })}
				/>
			)}
		</div>
	);
}

function BackgroundFields({ block, updateBlock }) {
	const isAnimation = block.backgroundMode === "animation";

	return (
		<div className="rounded-[--radius-default] border border-border bg-bg/50 p-4 space-y-4">
			<div
				className={
					isAnimation
						? "grid gap-4 lg:grid-cols-3"
						: "grid gap-4 lg:grid-cols-2"
				}
			>
				<div className="flex flex-col gap-1">
					<Label htmlFor={`block-${block.id}-background-mode`}>
						Background mode
					</Label>
					<Select
						id={`block-${block.id}-background-mode`}
						value={block.backgroundMode}
						onChange={(event) => {
							const nextMode = event.target.value;
							updateBlock(block.id, {
								backgroundMode: nextMode,
								backgroundValue:
									nextMode === "animation"
										? DEFAULT_ANIMATION_BACKGROUND
										: DEFAULT_COLOR_BACKGROUND,
								backgroundTone: block.backgroundTone,
							});
						}}
					>
						{PAGE_BACKGROUND_MODES.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>
				</div>

				<div className="flex flex-col gap-1">
					<Label htmlFor={`block-${block.id}-background-value`}>
						{isAnimation ? "Animation" : "Color tone"}
					</Label>
					<Select
						id={`block-${block.id}-background-value`}
						value={block.backgroundValue}
						onChange={(event) =>
							updateBlock(block.id, {
								backgroundValue: event.target.value,
							})
						}
					>
						{(isAnimation
							? PAGE_BACKGROUND_ANIMATIONS
							: PAGE_BACKGROUND_TONES
						).map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>
				</div>

				{isAnimation ? (
					<div className="flex flex-col gap-1">
						<Label htmlFor={`block-${block.id}-background-tone`}>
							Animation base color
						</Label>
						<Select
							id={`block-${block.id}-background-tone`}
							value={block.backgroundTone || DEFAULT_ANIMATION_TONE}
							onChange={(event) =>
								updateBlock(block.id, {
									backgroundTone: event.target.value,
								})
							}
						>
							{PAGE_BACKGROUND_TONES.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</Select>
					</div>
				) : null}
			</div>
		</div>
	);
}

function TextField({ id, label, value, placeholder, onChange }) {
	return (
		<div className="flex flex-col gap-1">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
			/>
		</div>
	);
}

function RichTextField({ id, label, value, rows, placeholder, onChange }) {
	return (
		<div className="flex flex-col gap-1">
			<Label htmlFor={id}>{label}</Label>
			<RichText
				key={id}
				id={id}
				defaultValue={value}
				rows={rows}
				onChange={onChange}
				placeholder={placeholder}
			/>
		</div>
	);
}
