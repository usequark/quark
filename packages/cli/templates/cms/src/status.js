/**
 * Valid content status transitions.
 *
 * DRAFT      → PUBLISHED
 * PUBLISHED  → DRAFT, ARCHIVED
 * ARCHIVED   → DRAFT
 */
const TRANSITIONS = {
	DRAFT: ["PUBLISHED"],
	PUBLISHED: ["DRAFT", "ARCHIVED"],
	ARCHIVED: ["DRAFT"],
};

/**
 * Returns true if transitioning from `from` to `to` is valid.
 * @param {string} from - Current status
 * @param {string} to   - Target status
 * @returns {boolean}
 */
export function canTransition(from, to) {
	return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Apply a status transition to a record's data object, adding side-effects:
 * - PUBLISHED: sets publishedAt to now if not already set
 * - DRAFT:     clears publishedAt
 * - ARCHIVED:  preserves publishedAt
 *
 * Returns a partial data object suitable for passing to `updateRecord`.
 * Does NOT mutate the input record.
 *
 * @param {object} record     - Current record (must have a `status` field)
 * @param {string} newStatus  - Target status
 * @returns {{ status: string, publishedAt?: Date | null }}
 */
export function applyTransition(record, newStatus) {
	const patch = { status: newStatus };

	if (newStatus === "PUBLISHED" && !record.publishedAt) {
		patch.publishedAt = new Date();
	}

	if (newStatus === "DRAFT") {
		patch.publishedAt = null;
	}

	return patch;
}
