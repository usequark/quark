"use client";

function formatTimeOnly(time24) {
	const [h, m] = time24.split(":").map(Number);
	const hour12 = h % 12 || 12;
	return `${hour12}:${String(m).padStart(2, "0")}`;
}

function getEndTime(startTime24, durationMinutes) {
	const [h, m] = startTime24.split(":").map(Number);
	const total = h * 60 + m + durationMinutes;
	const endH = Math.floor(total / 60) % 24;
	const endM = total % 60;
	return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function isPM(time24) {
	return Number.parseInt(time24.split(":")[0], 10) >= 12;
}

function buildTimeSlotsForDuration(durationMinutes) {
	const slots = [];
	const endHour = 21;

	for (let h = 9; h < 21; h++) {
		for (const m of [0, 30]) {
			const startMinutes = h * 60 + m;
			if (startMinutes + durationMinutes > endHour * 60) break;
			const start = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
			const end = getEndTime(start, durationMinutes);
			slots.push({ start, end });
		}
	}
	return slots;
}

export default function TimeSlotPicker({
	selectedDate,
	selectedTime,
	onSelect,
	duration,
	isTimeSlotAvailable,
}) {
	const durationMinutes = Number.parseInt(duration, 10) || 30;
	const slots = buildTimeSlotsForDuration(durationMinutes);

	const amSlots = slots.filter((s) => !isPM(s.start));
	const pmSlots = slots.filter((s) => isPM(s.start));

	if (!selectedDate) {
		return (
			<p className="text-sm text-text-muted py-2">
				Select a date first to see available times.
			</p>
		);
	}

	function renderSlotGroup(slots, label) {
		const availableSlots = slots.filter(
			(s) => isTimeSlotAvailable?.(s.start, durationMinutes) ?? true,
		);

		if (availableSlots.length === 0 && slots.length > 0 && label) return null;

		return (
			<div>
				<p className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-2.5">
					{label}
				</p>
				<div className="grid grid-cols-2 gap-2">
					{slots.map(({ start, end }) => {
						const available =
							isTimeSlotAvailable?.(start, durationMinutes) ?? true;
						const isSelected = selectedTime === start;
						const now = new Date();
						const slotDate = new Date(`${selectedDate}T${start}:00`);
						const isPast = slotDate <= now;
						const isDisabled = isPast || !available;

						return (
							<button
								key={start}
								type="button"
								disabled={isDisabled}
								onClick={() => onSelect(start)}
								className={`group rounded-lg border px-3 py-2.5 text-xs font-medium leading-tight transition-all duration-150 ${
									isSelected
										? "border-primary bg-primary text-white shadow-sm shadow-primary/30 cursor-pointer"
										: isDisabled
											? "border-border/40 bg-surface/50 text-text-faint/40 cursor-not-allowed"
											: "border-border bg-surface text-text hover:border-primary/30 hover:bg-primary/5 cursor-pointer"
								}`}
							>
								<span className="block tabular-nums">
									{formatTimeOnly(start)}
								</span>
								<span
									className={`block text-[10px] tabular-nums ${isSelected ? "text-white/70" : "text-text-faint group-hover:text-text-muted"}`}
								>
									{available ? `to ${formatTimeOnly(end)}` : "Booked"}
								</span>
							</button>
						);
					})}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-5 max-h-[420px] overflow-y-auto pr-1">
			{renderSlotGroup(amSlots, "Morning")}
			{renderSlotGroup(pmSlots, "Afternoon & Evening")}
		</div>
	);
}
