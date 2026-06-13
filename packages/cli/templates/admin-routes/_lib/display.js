/**
 * Format an ALL_CAPS enum value for display.
 * "IN_PROGRESS" → "IN PROGRESS", "COMPLETED" → "COMPLETED"
 */
export function formatEnumLabel(value) {
	if (typeof value !== "string") return value;
	return value.replace(/_/g, " ");
}
