const TRANSITIONS = {
	PENDING: ["CONFIRMED", "CANCELLED"],
	CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
	CANCELLED: [],
	COMPLETED: [],
	NO_SHOW: [],
};

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransition(from, to) {
	return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * @param {object} booking
 * @param {string} newStatus
 * @returns {object}
 */
export function applyTransition(booking, newStatus) {
	const patch = { status: newStatus };

	if (newStatus === "CANCELLED") {
		patch.cancelledAt = new Date();
	}

	if (newStatus === "PENDING" && !booking.cancelToken) {
		patch.cancelToken = crypto.randomUUID();
	}

	return patch;
}
