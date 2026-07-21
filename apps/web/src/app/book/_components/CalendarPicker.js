"use client";

import { useMemo, useState } from "react";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

function startOfMonth(date) {
	const d = new Date(date);
	d.setDate(1);
	d.setHours(0, 0, 0, 0);
	return d;
}

function addMonths(date, n) {
	const d = new Date(date);
	d.setMonth(d.getMonth() + n);
	return d;
}

function isSameDay(a, b) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function CalendarNavButton({ onClick, disabled, children, label }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
				disabled
					? "text-text-faint/30 cursor-not-allowed"
					: "text-text-muted hover:bg-surface-hover hover:text-text"
			}`}
			aria-label={label}
		>
			{children}
		</button>
	);
}

export default function CalendarPicker({ selectedDate, onSelect, error }) {
	const today = useMemo(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}, []);

	const maxDate = useMemo(() => {
		const d = new Date(today);
		d.setDate(d.getDate() + 30);
		return d;
	}, [today]);

	const [viewMonth, setViewMonth] = useState(() => startOfMonth(today));

	const selected = selectedDate ? new Date(`${selectedDate}T12:00:00`) : null;

	function canGoPrev() {
		return startOfMonth(viewMonth) > startOfMonth(today);
	}

	function canGoNext() {
		return startOfMonth(addMonths(viewMonth, 1)) <= startOfMonth(maxDate);
	}

	const calendarDays = useMemo(() => {
		const first = startOfMonth(viewMonth);
		const startDay = first.getDay();
		const days = [];

		for (let i = startDay - 1; i >= 0; i--) {
			const d = new Date(first);
			d.setDate(-i);
			days.push({ date: d, isOutOfMonth: true });
		}

		const lastDay = new Date(first);
		lastDay.setMonth(lastDay.getMonth() + 1);
		lastDay.setDate(0);
		const totalDays = lastDay.getDate();

		for (let i = 1; i <= totalDays; i++) {
			const d = new Date(first);
			d.setDate(i);
			days.push({ date: d, isOutOfMonth: false });
		}

		const remaining = 42 - days.length;
		for (let i = 1; i <= remaining; i++) {
			const d = new Date(lastDay);
			d.setDate(d.getDate() + i);
			days.push({ date: d, isOutOfMonth: true });
		}

		return days;
	}, [viewMonth]);

	function formatDateString(date) {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, "0");
		const d = String(date.getDate()).padStart(2, "0");
		return `${y}-${m}-${d}`;
	}

	return (
		<div className="space-y-3">
			<span className="block text-sm font-semibold text-text">Date</span>

			<div className="rounded-[--radius-default] border border-border bg-surface p-5">
				<div className="flex items-center justify-between mb-5">
					<CalendarNavButton
						onClick={() => setViewMonth(addMonths(viewMonth, -1))}
						disabled={!canGoPrev()}
						label="Previous month"
					>
						<svg
							className="h-4 w-4"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								fillRule="evenodd"
								d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
								clipRule="evenodd"
							/>
						</svg>
					</CalendarNavButton>

					<span className="text-sm font-semibold text-text">
						{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
					</span>

					<CalendarNavButton
						onClick={() => setViewMonth(addMonths(viewMonth, 1))}
						disabled={!canGoNext()}
						label="Next month"
					>
						<svg
							className="h-4 w-4"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								fillRule="evenodd"
								d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
								clipRule="evenodd"
							/>
						</svg>
					</CalendarNavButton>
				</div>

				<div className="grid grid-cols-7 mb-2">
					{DAYS_OF_WEEK.map((day) => (
						<div
							key={day}
							className="flex h-8 items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-text-faint"
						>
							{day}
						</div>
					))}
				</div>

				<div className="grid grid-cols-7">
					{calendarDays.map(({ date, isOutOfMonth }) => {
						const isToday = isSameDay(date, today);
						const isSelected = selected ? isSameDay(date, selected) : false;
						const isPast = date < today;
						const isBeyondMax = date > maxDate;
						const isDisabled = isOutOfMonth || isPast || isBeyondMax;

						return (
							<button
								key={date.getTime()}
								type="button"
								disabled={isDisabled}
								onClick={() => {
									onSelect(formatDateString(date));
								}}
								className={`relative flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-all duration-150 ${
									isSelected
										? "bg-primary text-white shadow-sm shadow-primary/30 cursor-pointer"
										: isToday && !isSelected
											? "text-primary ring-1 ring-inset ring-primary/30 hover:bg-primary/10 cursor-pointer"
											: isDisabled
												? "text-text-faint/25 cursor-not-allowed"
												: "text-text hover:bg-surface-hover cursor-pointer"
								}`}
							>
								{date.getDate()}
							</button>
						);
					})}
				</div>
			</div>

			<input type="hidden" name="date" value={selectedDate} />

			{error && <p className="text-sm text-red-500">{error[0]}</p>}
		</div>
	);
}
