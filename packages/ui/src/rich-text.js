"use client";
import React, {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { Button } from "./button.js";
import { Dialog } from "./dialog.js";
import { Input } from "./input.js";

/**
 * RichText — dependency-free rich text editor using contentEditable.
 *
 * Props:
 *   id            (string)   — id applied to the editor div for label association
 *   name          (string)   — form field name (value submitted as HTML string)
 *   defaultValue  (string)   — initial HTML content
 *   placeholder   (string)   — placeholder text when empty
 *   disabled      (bool)     — read-only mode
 *   required      (bool)     — form validation
 *   rows          (number)   — approximate visible rows (default 6)
 *   className     (string)   — merged onto the outer wrapper
 *   onChange      (fn)       — called with HTML string on content change
 */

const wrapperCls =
	"rounded-[--radius-default] border border-border bg-surface-hover text-sm text-text transition-colors duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden";

const toolbarCls =
	"flex flex-wrap items-center gap-0.5 border-b border-border bg-surface px-2 py-1.5";

const btnBase =
	"inline-flex items-center justify-center w-7 h-7 rounded-[--radius-default] text-text-muted transition-colors cursor-pointer hover:bg-surface-hover hover:text-text disabled:opacity-30 disabled:cursor-not-allowed";

const btnActive = "bg-surface-hover text-text";

const separatorCls = "w-px h-5 bg-border mx-1";

const editorCls =
	"outline-none px-3 py-2 overflow-y-auto prose-sm [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-text-muted [&_blockquote]:my-2 [&_code]:bg-surface-hover [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono";

const placeholderCls =
	"before:content-[attr(data-placeholder)] before:text-text-faint before:pointer-events-none before:absolute before:left-3 before:top-2";

const TOOLBAR_ITEMS = [
	{ command: "bold", icon: "B", title: "Bold", style: "font-bold" },
	{ command: "italic", icon: "I", title: "Italic", style: "italic" },
	{
		command: "strikeThrough",
		icon: "S",
		title: "Strikethrough",
		style: "line-through",
	},
	"separator",
	{
		command: "formatBlock",
		arg: "h1",
		icon: "H1",
		title: "Heading 1",
		style: "text-xs font-bold",
	},
	{
		command: "formatBlock",
		arg: "h2",
		icon: "H2",
		title: "Heading 2",
		style: "text-xs font-bold",
	},
	{
		command: "formatBlock",
		arg: "h3",
		icon: "H3",
		title: "Heading 3",
		style: "text-xs font-bold",
	},
	"separator",
	{
		command: "insertUnorderedList",
		icon: "ul",
		title: "Bullet list",
		svg: true,
	},
	{
		command: "insertOrderedList",
		icon: "ol",
		title: "Numbered list",
		svg: true,
	},
	"separator",
	{ command: "formatBlock", arg: "blockquote", icon: "❝", title: "Quote" },
	{ command: "createLink", icon: "🔗", title: "Insert link", isLink: true },
];

/**
 * @param {string} command
 * @returns {boolean}
 */
function queryActive(command) {
	try {
		return document.queryCommandState(command);
	} catch {
		return false;
	}
}

export function RichText({
	id,
	name,
	defaultValue = "",
	placeholder = "",
	disabled = false,
	required = false,
	rows = 6,
	className = "",
	onChange,
}) {
	const editorRef = useRef(null);
	const hiddenRef = useRef(null);
	const [activeStates, setActiveStates] = useState({});
	const [isEmpty, setIsEmpty] = useState(!defaultValue);
	const [linkDialogOpen, setLinkDialogOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState("");
	const [linkError, setLinkError] = useState("");
	const savedRangeRef = useRef(null);
	const linkInputId = useId();

	// Sync hidden input value with editor content
	const syncValue = useCallback(() => {
		const el = editorRef.current;
		if (!el) return;
		const html = el.innerHTML;
		const textEmpty =
			!el.textContent?.trim() && !el.querySelector("img,hr,table");
		setIsEmpty(textEmpty);
		if (hiddenRef.current) {
			hiddenRef.current.value = textEmpty ? "" : html;
		}
		onChange?.(textEmpty ? "" : html);
	}, [onChange]);

	// Update toolbar active states
	const updateToolbar = useCallback(() => {
		setActiveStates({
			bold: queryActive("bold"),
			italic: queryActive("italic"),
			strikeThrough: queryActive("strikeThrough"),
			insertUnorderedList: queryActive("insertUnorderedList"),
			insertOrderedList: queryActive("insertOrderedList"),
		});
	}, []);

	// Set initial content before the browser paints to prevent a flash of
	// empty editor on first mount (same fix as Dialog's showModal() call).
	const initializedRef = useRef(false);
	useLayoutEffect(() => {
		if (!initializedRef.current && editorRef.current && defaultValue) {
			initializedRef.current = true;
			editorRef.current.innerHTML = sanitizeHtml(defaultValue);
			syncValue();
		}
	}, [defaultValue, syncValue]);

	const exec = useCallback(
		(command, arg) => {
			if (disabled) return;
			editorRef.current?.focus();
			if (command === "createLink") {
				const sel = window.getSelection();
				if (sel && sel.rangeCount > 0) {
					savedRangeRef.current = sel.getRangeAt(0).cloneRange();
				}
				setLinkUrl("");
				setLinkError("");
				setLinkDialogOpen(true);
				return;
			} else if (command === "formatBlock") {
				document.execCommand("formatBlock", false, `<${arg}>`);
			} else {
				document.execCommand(command, false, arg ?? null);
			}
			syncValue();
			updateToolbar();
		},
		[disabled, syncValue, updateToolbar],
	);

	const confirmLink = useCallback(() => {
		const trimmed = linkUrl.trim();
		if (!trimmed) {
			setLinkError("Please enter a URL.");
			return;
		}
		if (!isSafeUrl(trimmed)) {
			setLinkError("Only http:// and https:// URLs are allowed.");
			return;
		}
		const sel = window.getSelection();
		if (sel && savedRangeRef.current) {
			sel.removeAllRanges();
			sel.addRange(savedRangeRef.current);
		}
		editorRef.current?.focus();
		document.execCommand("createLink", false, trimmed);
		setLinkDialogOpen(false);
		setLinkUrl("");
		setLinkError("");
		savedRangeRef.current = null;
		syncValue();
		updateToolbar();
	}, [linkUrl, syncValue, updateToolbar]);

	const cancelLink = useCallback(() => {
		setLinkDialogOpen(false);
		setLinkUrl("");
		setLinkError("");
		savedRangeRef.current = null;
	}, []);

	useEffect(() => {
		if (!linkDialogOpen) return;
		const handle = requestAnimationFrame(() => {
			document.getElementById(linkInputId)?.focus();
		});
		return () => cancelAnimationFrame(handle);
	}, [linkDialogOpen, linkInputId]);

	const onInput = useCallback(() => {
		syncValue();
		updateToolbar();
	}, [syncValue, updateToolbar]);

	const onKeyUp = useCallback(() => {
		updateToolbar();
	}, [updateToolbar]);

	const onMouseUp = useCallback(() => {
		updateToolbar();
	}, [updateToolbar]);

	// Prevent pasting formatted HTML — paste as clean HTML but strip dangerous tags
	const onPaste = useCallback(
		(e) => {
			e.preventDefault();
			const html = e.clipboardData?.getData("text/html");
			const text = e.clipboardData?.getData("text/plain") ?? "";
			if (html) {
				// Sanitize: strip script, style, event handlers
				const clean = sanitizeHtml(html);
				document.execCommand("insertHTML", false, clean);
			} else {
				document.execCommand("insertText", false, text);
			}
			syncValue();
		},
		[syncValue],
	);

	const minHeight = rows * 24;

	// Toolbar
	const toolbar = React.createElement(
		"div",
		{ className: toolbarCls, role: "toolbar", "aria-label": "Text formatting" },
		...TOOLBAR_ITEMS.map((item, i) => {
			if (item === "separator") {
				return React.createElement("div", {
					key: `sep-${i}`,
					className: separatorCls,
					role: "separator",
				});
			}
			const isActive = activeStates[item.command] || false;
			const btnCls = `${btnBase} ${isActive ? btnActive : ""}`;

			let content;
			if (item.svg) {
				content =
					item.icon === "ul"
						? React.createElement(
								"svg",
								{
									"aria-hidden": "true",
									className: "w-4 h-4",
									fill: "none",
									viewBox: "0 0 24 24",
									stroke: "currentColor",
									strokeWidth: 2,
								},
								React.createElement("path", {
									strokeLinecap: "round",
									strokeLinejoin: "round",
									d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
								}),
							)
						: React.createElement(
								"svg",
								{
									"aria-hidden": "true",
									className: "w-4 h-4",
									fill: "none",
									viewBox: "0 0 24 24",
									stroke: "currentColor",
									strokeWidth: 2,
								},
								React.createElement("path", {
									strokeLinecap: "round",
									strokeLinejoin: "round",
									d: "M10 6h11M10 12h11M10 18h11M4 6V4l2 2M4 12v-1l1 1 1-1v1M4 18v-2h2v1H4v1h2",
								}),
							);
			} else {
				content = React.createElement(
					"span",
					{ className: item.style || "text-xs" },
					item.icon,
				);
			}

			return React.createElement(
				"button",
				{
					key: item.command + (item.arg || ""),
					type: "button",
					title: item.title,
					"aria-label": item.title,
					"aria-pressed": isActive,
					disabled,
					className: btnCls,
					onMouseDown: (e) => {
						e.preventDefault(); // prevent editor blur
						exec(item.command, item.arg);
					},
				},
				content,
			);
		}),
	);

	// Editor area
	const editor = React.createElement("div", {
		id,
		ref: editorRef,
		contentEditable: !disabled,
		suppressContentEditableWarning: true,
		onInput,
		onKeyUp,
		onMouseUp,
		onPaste,
		role: "textbox",
		"aria-multiline": "true",
		"aria-label": name || "Rich text editor",
		"data-placeholder": placeholder,
		className: `${editorCls} relative ${isEmpty ? placeholderCls : ""}`,
		style: { minHeight: `${minHeight}px` },
	});

	// Hidden input for form submission
	const hidden = React.createElement("input", {
		ref: hiddenRef,
		type: "hidden",
		name,
		defaultValue: defaultValue || "",
		required,
	});

	return React.createElement(
		"div",
		{
			className:
				`${wrapperCls} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`.trim(),
		},
		toolbar,
		editor,
		hidden,
		React.createElement(
			Dialog,
			{ open: linkDialogOpen, onClose: cancelLink, title: "Insert Link" },
			React.createElement(
				"div",
				{ className: "space-y-4" },
				React.createElement(
					"div",
					null,
					React.createElement(
						"label",
						{
							htmlFor: linkInputId,
							className: "block text-sm font-medium text-text mb-1.5",
						},
						"Link URL",
					),
					React.createElement(Input, {
						id: linkInputId,
						type: "url",
						placeholder: "https://example.com",
						value: linkUrl,
						onChange: (e) => {
							setLinkUrl(e.target.value);
							setLinkError("");
						},
						onKeyDown: (e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								confirmLink();
							}
						},
					}),
					linkError
						? React.createElement(
								"p",
								{ className: "mt-1.5 text-xs text-danger" },
								linkError,
							)
						: null,
				),
				React.createElement(
					"div",
					{ className: "flex justify-end gap-2 pt-1" },
					React.createElement(
						Button,
						{ variant: "primary", type: "button", onClick: confirmLink },
						"Insert",
					),
					React.createElement(
						Button,
						{ variant: "secondary", type: "button", onClick: cancelLink },
						"Cancel",
					),
				),
			),
		),
	);
}

/**
 * Sanitize HTML by stripping dangerous elements and attributes.
 * @param {string} html
 * @returns {string}
 */
function sanitizeHtml(html) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// Remove dangerous elements
	const dangerous = doc.querySelectorAll(
		"script,style,iframe,object,embed,form,input,textarea,select,button,link,meta",
	);
	for (const el of dangerous) el.remove();

	// Remove event handler attributes and javascript: URLs
	const all = doc.body.querySelectorAll("*");
	for (const el of all) {
		for (const attr of [...el.attributes]) {
			if (
				attr.name.startsWith("on") ||
				(attr.name === "href" &&
					attr.value
						.replace(/\s/g, "")
						.toLowerCase()
						.startsWith("javascript:")) ||
				(attr.name === "src" &&
					attr.value.replace(/\s/g, "").toLowerCase().startsWith("javascript:"))
			) {
				el.removeAttribute(attr.name);
			}
		}
	}

	return doc.body.innerHTML;
}

/**
 * Returns true if the URL uses an allowed protocol (http or https only).
 * Prevents javascript:, vbscript:, and data: XSS vectors.
 * @param {string} url
 * @returns {boolean}
 */
function isSafeUrl(url) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		// Relative URLs (no protocol) are safe
		return !url
			.replace(/\s/g, "")
			.toLowerCase()
			.match(/^[a-z][a-z0-9+.-]*:/);
	}
}
