"use client";

import { Label } from "@techstream/quark-ui";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Generate a URL-safe slug from a title string (client-side mirror of cms/slug.js).
 * @param {string} title
 * @returns {string}
 */
function generateSlug(title) {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/[\s]+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Slug field with auto-generation from `title` and a lock/edit toggle.
 *
 * @param {{
 *   title: string,
 *   defaultSlug?: string,
 *   name?: string,
 *   required?: boolean,
 *   disabled?: boolean
 * }} props
 */
export default function SlugField({
	title,
	defaultSlug = "",
	name = "slug",
	required = false,
	disabled = false,
}) {
	const id = useId();
	const [autoMode, setAutoMode] = useState(!defaultSlug);
	const [isEditing, setIsEditing] = useState(false);
	const [slug, setSlug] = useState(defaultSlug);
	const inputRef = useRef(null);

	useEffect(() => {
		if (autoMode) {
			setSlug(generateSlug(title));
		}
	}, [title, autoMode]);

	function handleEdit() {
		setAutoMode(false);
		setIsEditing(true);
		setTimeout(() => inputRef.current?.focus(), 0);
	}

	function handleUseTitle() {
		setSlug(generateSlug(title));
		setAutoMode(true);
		setIsEditing(false);
	}

	const readOnly = disabled || !isEditing;

	let helperText = null;
	if (autoMode) {
		helperText = "Auto-generated from the title. Click Edit to customize.";
	} else if (isEditing) {
		helperText =
			"Custom slug. Use title to switch back to the generated value.";
	} else if (defaultSlug) {
		helperText = "Using the saved slug. Click Edit to customize.";
	}

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between">
				<Label htmlFor={id}>
					Slug
					{required && (
						<span
							className="ml-0.5 text-danger"
							aria-hidden="true"
							title="Required field"
						>
							*
						</span>
					)}
				</Label>
				{!disabled && (
					<button
						type="button"
						onClick={isEditing ? handleUseTitle : handleEdit}
						className="text-xs text-primary underline hover:opacity-75 transition-opacity"
					>
						{isEditing ? "Use title" : "Edit"}
					</button>
				)}
			</div>
			<div
				className={`flex h-10 items-center rounded-[--radius-default] border bg-surface transition-colors duration-200 linear ${
					disabled
						? "cursor-not-allowed border-border opacity-30"
						: readOnly
							? "border-border bg-surface-hover text-text-muted"
							: "border-border hover:border-border-hover focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
				}`}
			>
				<span className="pl-3 text-sm font-mono text-text-faint">/</span>
				<input
					ref={inputRef}
					id={id}
					type="text"
					name={name}
					value={slug}
					onChange={(e) => setSlug(generateSlug(e.target.value))}
					readOnly={readOnly}
					aria-readonly={readOnly}
					disabled={disabled}
					required={required}
					placeholder="auto-generated-from-title"
					className="h-full w-full bg-transparent px-2 pr-3 font-mono text-sm text-text placeholder-text-faint outline-none disabled:cursor-not-allowed"
				/>
			</div>
			{helperText && <p className="text-xs text-text-faint">{helperText}</p>}
		</div>
	);
}
