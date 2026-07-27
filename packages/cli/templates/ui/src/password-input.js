"use client";

import { Eye, EyeOff } from "lucide-react";
import React from "react";
import { Input } from "./input.js";

export function PasswordInput({ className = "", ...props }) {
	const [visible, setVisible] = React.useState(false);
	const Icon = visible ? EyeOff : Eye;

	return React.createElement(
		"div",
		{ className: `relative ${className}`.trim() },
		React.createElement(Input, {
			type: visible ? "text" : "password",
			className: "pr-10",
			...props,
		}),
		React.createElement(
			"button",
			{
				type: "button",
				onClick: () => setVisible((v) => !v),
				"aria-label": visible ? "Hide password" : "Show password",
				className:
					"absolute right-2.5 top-1/2 -translate-y-1/2 text-[--input-icon] hover:text-[--input-icon-hover] transition-colors",
			},
			React.createElement(Icon, { size: 16, "aria-hidden": true }),
		),
	);
}
