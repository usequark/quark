"use client";

import { Input, Label } from "@techstream/quark-ui";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Debounce a value by `delay` ms.
 * @param {string} value
 * @param {number} delay
 */
function useDebounce(value, delay) {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const id = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(id);
	}, [value, delay]);
	return debounced;
}

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
	// Lock by default: if editing an existing record (defaultSlug provided), start locked.
	// For new records (no defaultSlug), start unlocked so auto-generation can run once,
	// then auto-lock on first non-empty generation.
	const [locked, setLocked] = useState(!!defaultSlug);
	const [slug, setSlug] = useState(defaultSlug);
	const inputRef = useRef(null);

	const debouncedTitle = useDebounce(title, 350);

	// Auto-generate slug from title when unlocked. Auto-lock on first generation
	// so the slug is stable once created (user must click Edit to change it).
	useEffect(() => {
		if (!locked && debouncedTitle) {
			const generated = generateSlug(debouncedTitle);
			if (generated) {
				setSlug(generated);
				setLocked(true); // lock immediately after first auto-generation
			}
		}
	}, [debouncedTitle, locked]);

	function handleUnlock() {
		setLocked(false);
		setTimeout(() => inputRef.current?.focus(), 0);
	}

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between">
				<Label htmlFor={id}>Slug{required && " *"}</Label>
				{!disabled && (
					<button
						type="button"
						onClick={locked ? handleUnlock : () => setLocked(true)}
						className="text-xs text-text-faint hover:text-text transition-colors"
					>
						{locked ? "Edit" : "Lock"}
					</button>
				)}
			</div>
			<Input
				ref={inputRef}
				id={id}
				type="text"
				name={name}
				value={slug}
				onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))}
				disabled={disabled || locked}
				required={required}
				placeholder="auto-generated-from-title"
				className="font-mono text-sm"
			/>
			{slug && <p className="text-xs text-text-faint font-mono">/{slug}</p>}
		</div>
	);
}
