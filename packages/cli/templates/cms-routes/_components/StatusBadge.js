import { Badge } from "@techstream/quark-ui";

const STATUS_VARIANTS = {
	DRAFT: "warning",
	PUBLISHED: "success",
	ARCHIVED: "default",
};

const STATUS_LABELS = {
	DRAFT: "Draft",
	PUBLISHED: "Published",
	ARCHIVED: "Archived",
};

/**
 * @param {{ status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }} props
 */
export default function StatusBadge({ status }) {
	const variant = STATUS_VARIANTS[status] ?? "default";
	const label = STATUS_LABELS[status] ?? status;
	return <Badge variant={variant}>{label}</Badge>;
}
