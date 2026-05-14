"use client";
import { Check, ChevronDown } from "lucide-react";
import React, {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

const triggerCls =
	"flex h-10 w-full items-center justify-between rounded-[--radius-default] border border-border bg-surface px-3 text-sm text-text shadow-sm transition-all duration-200 cursor-pointer hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50";

const panelCls =
	"absolute z-30 max-h-60 w-full overflow-auto rounded-[--radius-default] border border-border bg-surface shadow-xl origin-top transition-all duration-200 ease-out";

const optionBaseCls =
	"flex w-full items-center justify-between rounded-[--radius-default] px-2.5 py-2 text-left text-sm transition-colors duration-150";

const optionIdleCls =
	"cursor-pointer text-text-muted hover:bg-surface-hover hover:text-text";

const optionActiveCls = "bg-primary-muted text-primary";

function normalizeValue(value) {
	if (value === undefined || value === null) return "";
	return String(value);
}

function toText(value) {
	if (value === undefined || value === null) return "";
	if (typeof value === "string" || typeof value === "number") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value
			.map((item) => toText(item))
			.join(" ")
			.trim();
	}
	if (React.isValidElement(value)) {
		return toText(value.props?.children);
	}
	return "";
}

function collectOptions(children) {
	const items = React.Children.toArray(children);

	return items.flatMap((child, index) => {
		if (!React.isValidElement(child)) return [];
		if (child.type === React.Fragment) {
			return collectOptions(child.props?.children);
		}
		if (
			typeof child.type !== "string" ||
			child.type.toLowerCase() !== "option"
		) {
			return [];
		}

		const label = toText(child.props?.children);
		const rawValue = child.props?.value ?? label;

		return [
			{
				key: child.key ?? `${rawValue}-${index}`,
				value: normalizeValue(rawValue),
				label,
				disabled: Boolean(child.props?.disabled),
			},
		];
	});
}

function createChangeEvent(nextValue, name, id) {
	const target = {
		value: nextValue,
		name,
		id,
	};

	return {
		type: "change",
		target,
		currentTarget: target,
	};
}

export function Select({
	className = "",
	children,
	value,
	defaultValue,
	onChange,
	disabled = false,
	id,
	name,
	placeholder = "Choose...",
	required = false,
	onBlur,
	onFocus,
	...props
}) {
	const options = useMemo(() => collectOptions(children), [children]);
	const generatedId = useId();
	const selectId = id ?? generatedId;
	const panelId = `${selectId}-panel`;
	const isControlled = value !== undefined;

	const initialValue = useMemo(() => {
		if (isControlled) return normalizeValue(value);
		if (defaultValue !== undefined) return normalizeValue(defaultValue);
		return options[0]?.value ?? "";
	}, [isControlled, value, defaultValue, options]);

	const [open, setOpen] = useState(false);
	const [internalValue, setInternalValue] = useState(initialValue);
	const rootRef = useRef(null);

	const selectedValue = isControlled ? normalizeValue(value) : internalValue;
	const selectedOption = options.find(
		(option) => option.value === selectedValue,
	);
	const triggerDisabled = disabled || options.length === 0;
	const panelStateCls = open
		? "opacity-100 scale-y-100 pointer-events-auto"
		: "opacity-0 scale-y-0 pointer-events-none";

	useEffect(() => {
		if (isControlled) {
			setInternalValue(normalizeValue(value));
		}
	}, [isControlled, value]);

	useEffect(() => {
		if (isControlled) return;
		const hasValue = options.some((option) => option.value === internalValue);
		if (hasValue) return;
		setInternalValue(initialValue);
	}, [isControlled, options, internalValue, initialValue]);

	useEffect(() => {
		if (!open) return;

		function onPointerDown(event) {
			if (rootRef.current?.contains(event.target)) return;
			setOpen(false);
		}

		function onEscape(event) {
			if (event.key === "Escape") setOpen(false);
		}

		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onEscape);

		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onEscape);
		};
	}, [open]);

	const commitValue = useCallback(
		(nextValue) => {
			if (!isControlled) {
				setInternalValue(nextValue);
			}
			onChange?.(createChangeEvent(nextValue, name, selectId));
		},
		[isControlled, onChange, name, selectId],
	);

	const toggleOpen = useCallback(() => {
		if (triggerDisabled) return;
		setOpen((state) => !state);
	}, [triggerDisabled]);

	const handleTriggerKeyDown = useCallback(
		(event) => {
			if (triggerDisabled) return;

			if (
				event.key === "ArrowDown" ||
				event.key === "Enter" ||
				event.key === " "
			) {
				event.preventDefault();
				setOpen(true);
			}

			if (event.key === "Escape") {
				event.preventDefault();
				setOpen(false);
			}
		},
		[triggerDisabled],
	);

	return React.createElement(
		"div",
		{ className: "relative", ref: rootRef },
		name
			? React.createElement(
					"select",
					{
						name,
						value: selectedValue,
						required,
						disabled: triggerDisabled,
						tabIndex: -1,
						"aria-hidden": "true",
						onChange: () => {},
						className: "sr-only",
					},
					options.map((option) =>
						React.createElement(
							"option",
							{
								key: option.key,
								value: option.value,
								disabled: option.disabled,
							},
							option.label || option.value,
						),
					),
				)
			: null,
		React.createElement(
			"button",
			{
				type: "button",
				id: selectId,
				disabled: triggerDisabled,
				onBlur,
				onFocus,
				onClick: toggleOpen,
				onKeyDown: handleTriggerKeyDown,
				"aria-haspopup": "listbox",
				"aria-expanded": open,
				"aria-controls": panelId,
				"aria-required": required,
				className: `${triggerCls} ${className}`.trim(),
				...props,
			},
			React.createElement(
				"span",
				{ className: selectedOption ? "text-text" : "text-text-faint" },
				selectedOption?.label ??
					(options.length === 0 ? "No options" : placeholder),
			),
			React.createElement(
				"span",
				{
					"aria-hidden": "true",
					className:
						`ml-2 text-text-faint transition-transform duration-200 ease-in-out ${open ? "rotate-180" : "rotate-0"}`.trim(),
				},
				React.createElement(ChevronDown, { size: 16 }),
			),
		),
		React.createElement(
			"div",
			{
				id: panelId,
				role: "listbox",
				"aria-hidden": !open,
				className: `${panelCls} ${panelStateCls}`.trim(),
			},
			options.length === 0
				? React.createElement(
						"p",
						{ className: "px-2.5 py-2 text-sm text-text-faint" },
						"No options",
					)
				: options.map((option) => {
						const selected = option.value === selectedValue;
						const isOptionDisabled = option.disabled || !open;
						return React.createElement(
							"button",
							{
								type: "button",
								key: option.key,
								role: "option",
								"aria-selected": selected,
								disabled: isOptionDisabled,
								tabIndex: open ? 0 : -1,
								onClick: () => {
									if (option.disabled) return;
									commitValue(option.value);
									setOpen(false);
								},
								className:
									`${optionBaseCls} ${selected ? optionActiveCls : optionIdleCls} ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`.trim(),
							},
							React.createElement("span", null, option.label || option.value),
							selected
								? React.createElement(
										"span",
										{ "aria-hidden": "true", className: "text-primary" },
										React.createElement(Check, { size: 16 }),
									)
								: null,
						);
					}),
		),
	);
}
