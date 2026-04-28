"use client";

import { Badge } from "@techstream/quark-ui";

const STATUS_VARIANTS = {
	DRAFT: "warning",
	PUBLISHED: "success",
	ARCHIVED: "default",
};

/**
 * @param {{ status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }} props
 */
export default function StatusBadge({ status }) {
	const variant = STATUS_VARIANTS[status] ?? "default";
	return <Badge variant={variant}>{status}</Badge>;
}
