export const SLOT_SCOPE_PER_SERVICE = "PER_SERVICE";
export const SLOT_SCOPE_SHARED = "SHARED";
const SHARED_SLOT_SCOPE_KEY = "GLOBAL";

function getSlotScopeFromEnv() {
	const configuredScope = (process.env.BOOKING_SLOT_SCOPE || "")
		.trim()
		.toUpperCase();

	if (configuredScope === SLOT_SCOPE_SHARED) {
		return SLOT_SCOPE_SHARED;
	}

	return SLOT_SCOPE_PER_SERVICE;
}

export const bookingsConfig = {
	scheduling: {
		slotInterval: 30,
		defaultServiceDuration: 30,
		bufferBetweenSlots: 0,
		minAdvanceNotice: 60,
		maxAdvanceBooking: 43200,
		slotScope: getSlotScopeFromEnv(),
		timezone: "America/New_York",
		workingHours: {
			monday: { start: "09:00", end: "21:00" },
			tuesday: { start: "09:00", end: "21:00" },
			wednesday: { start: "09:00", end: "21:00" },
			thursday: { start: "09:00", end: "21:00" },
			friday: { start: "09:00", end: "21:00" },
			saturday: { start: "09:00", end: "21:00" },
			sunday: { start: "09:00", end: "21:00" },
		},
	},

	notifications: {
		sendConfirmation: true,
		sendCancellation: true,
		sendReminder: true,
		reminderBeforeMinutes: 1440,
	},

	cancellation: {
		enabled: true,
		minHoursBeforeSlot: 24,
		allowReason: true,
	},

	public: {
		allowGuestBookings: true,
		requirePhone: false,
		requireAccount: false,
		maxBookingsPerSlot: 1,
	},

	admin: {
		pageSize: 25,
		slotCalendarRange: 60,
	},
};

export function isSharedSlotScope() {
	return bookingsConfig.scheduling.slotScope === SLOT_SCOPE_SHARED;
}

function normalizeSlotScope(scope) {
	const normalized = (scope || "").toUpperCase();
	if (normalized === SLOT_SCOPE_SHARED) {
		return SLOT_SCOPE_SHARED;
	}

	return SLOT_SCOPE_PER_SERVICE;
}

export function resolveSlotScopeKey(serviceId, options = {}) {
	const slotScope = normalizeSlotScope(
		options.scope || bookingsConfig.scheduling.slotScope,
	);

	if (slotScope === SLOT_SCOPE_SHARED) {
		return SHARED_SLOT_SCOPE_KEY;
	}

	return serviceId;
}
