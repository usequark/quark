"use client";

import { Toast, useToast } from "@techstream/quark-ui";
import { useEffect, useRef } from "react";

const DEFAULT_TOAST_MESSAGES = {
	created: "{resource} created.",
	updated: "{resource} updated.",
	deleted: "{resource} deleted.",
};

export default function AdminActionToast({
	toastKey,
	resourceLabel,
	messageOverrides,
}) {
	const toast = useToast();
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
		const message = resourceLabel
			? messageTemplate.replace("{resource}", resourceLabel)
			: messageTemplate.replace("{resource}", "Item");
		toast.show(message, "success");

		const url = new URL(window.location.href);
		url.searchParams.delete("toast");
		window.history.replaceState(
			{},
			"",
			`${url.pathname}${url.search}${url.hash}`,
		);
	}, [messageOverrides, resourceLabel, toast, toastKey]);

	return <Toast {...toast.toastProps} />;
}
