"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_TOAST_MESSAGES = {
	created: "{resource} created.",
	updated: "{resource} updated.",
	deleted: "{resource} deleted.",
};

/**
 * Neutral inline toast for admin actions. Replaces the themed quark-ui Toast
 * with a plain gray banner so the admin shell carries no themed UI.
 */
export default function AdminActionToast({
	toastKey,
	resourceLabel,
	messageOverrides,
}) {
	const [message, setMessage] = useState(null);
	const shownKeyRef = useRef(null);

	useEffect(() => {
		if (!toastKey) return;
		if (shownKeyRef.current === toastKey) return;

		const mergedMessages = {
			...DEFAULT_TOAST_MESSAGES,
			...(messageOverrides ?? {}),
		};
		const messageTemplate = mergedMessages[toastKey];
		if (!messageTemplate) return;

		shownKeyRef.current = toastKey;
		const text = resourceLabel
			? messageTemplate.replace("{resource}", resourceLabel)
			: messageTemplate.replace("{resource}", "Item");
		setMessage(text);

		const url = new URL(window.location.href);
		url.searchParams.delete("toast");
		window.history.replaceState(
			{},
			"",
			`${url.pathname}${url.search}${url.hash}`,
		);
	}, [messageOverrides, resourceLabel, toastKey]);

	if (!message) return null;

	return (
		<div
			role="status"
			className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"
		>
			{message}
		</div>
	);
}
