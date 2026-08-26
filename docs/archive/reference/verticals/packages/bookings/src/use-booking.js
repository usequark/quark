"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DURATION_OPTIONS = [
	{ value: "30", label: "30 minutes", priceLabel: "$ / 30 min" },
	{ value: "60", label: "1 hour", priceLabel: "$ / 1 hr" },
	{ value: "90", label: "1 hour 30 minutes", priceLabel: "$ / 90 min" },
	{ value: "120", label: "2 hours", priceLabel: "$ / 2 hr" },
];

const STEPS = [
	{
		num: 1,
		label: "Lane",
		title: "Select Lane Type",
		desc: "Choose the batting cage lane you'd like to book.",
	},
	{ num: 2, label: "Duration", title: "How Long?", desc: null },
	{ num: 3, label: "Schedule", title: "Choose Date & Time", desc: null },
	{
		num: 4,
		label: "Details",
		title: "Your Details",
		desc: "Enter your contact information to complete the booking.",
	},
];

function formatTimeDisplay(time24) {
	const [h, m] = time24.split(":").map(Number);
	const period = h >= 12 ? "PM" : "AM";
	const hour12 = h % 12 || 12;
	return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function getEndTime(startTime24, durationMinutes) {
	const [h, m] = startTime24.split(":").map(Number);
	const total = h * 60 + m + durationMinutes;
	const endH = Math.floor(total / 60) % 24;
	const endM = total % 60;
	return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function getConsecutiveSlotTimes(startTime24, durationMinutes) {
	const [h, m] = startTime24.split(":").map(Number);
	const blocks = durationMinutes / 30;
	const times = [];

	for (let i = 0; i < blocks; i++) {
		const blockMin = m + i * 30;
		const blockH = h + Math.floor(blockMin / 60);
		const blockM = blockMin % 60;
		times.push(
			`${String(blockH).padStart(2, "0")}:${String(blockM).padStart(2, "0")}`,
		);
	}

	return times;
}

export function useBooking({ services, action, getBookedSlots }) {
	const [step, setStep] = useState(1);
	const [direction, setDirection] = useState(1);
	const [selectedServiceId, setSelectedServiceId] = useState(null);
	const [selectedDuration, setSelectedDuration] = useState("30");
	const [selectedDate, setSelectedDate] = useState("");
	const [selectedTime, setSelectedTime] = useState("");
	const [stepErrors, setStepErrors] = useState({});
	const [formErrors, setFormErrors] = useState({});
	const [pending, setPending] = useState(false);
	const [bookedSlotTimes, setBookedSlotTimes] = useState(new Set());
	const hasSubmittedRef = useRef(false);
	const isSubmittingRef = useRef(false);

	const selectedService = useMemo(
		() => services.find((s) => s.id === selectedServiceId) || null,
		[services, selectedServiceId],
	);

	const durationMinutes = Number.parseInt(selectedDuration, 10);
	const durationLabel = DURATION_OPTIONS.find(
		(o) => o.value === selectedDuration,
	)?.label;

	const stepMeta = STEPS[step - 1];

	const goToStep = useCallback(
		(newStep) => {
			hasSubmittedRef.current = false;
			setDirection(newStep > step ? 1 : -1);
			setStep(newStep);
			setStepErrors({});
			setFormErrors({});
		},
		[step],
	);

	const handleNext = useCallback(() => {
		hasSubmittedRef.current = false;
		if (step === 1 && !selectedService) {
			setStepErrors({ serviceTypeId: ["Please select a lane type"] });
			return;
		}
		if (step === 3 && (!selectedDate || !selectedTime)) {
			setStepErrors({
				...(!selectedDate && { date: ["Please select a date"] }),
				...(!selectedTime && { startTime: ["Please select a time"] }),
			});
			return;
		}
		setStepErrors({});
		setFormErrors({});
		goToStep(step + 1);
	}, [step, selectedService, selectedDate, selectedTime, goToStep]);

	const handleBack = useCallback(() => {
		hasSubmittedRef.current = false;
		goToStep(step - 1);
	}, [step, goToStep]);

	const handleSubmit = useCallback(
		async (event) => {
			event.preventDefault();

			if (isSubmittingRef.current) return;
			isSubmittingRef.current = true;

			setPending(true);
			setFormErrors({});
			hasSubmittedRef.current = true;

			try {
				const form = event.currentTarget.closest("form");
				const formData = new FormData(form);

				formData.set("serviceTypeId", selectedService?.id || "");
				formData.set("date", selectedDate);
				formData.set("startTime", selectedTime);
				formData.set("duration", selectedDuration);

				const result = await action({}, formData);

				if (result?.errors) {
					setFormErrors(result.errors);
					setPending(false);
					isSubmittingRef.current = false;
				}
			} catch {
				setFormErrors({
					_form: ["Something went wrong. Please try again."],
				});
				setPending(false);
				isSubmittingRef.current = false;
			}
		},
		[selectedService, selectedDate, selectedTime, selectedDuration, action],
	);

	useEffect(() => {
		if (!selectedServiceId || !selectedDate || !getBookedSlots) return;

		let cancelled = false;

		async function fetchBooked() {
			try {
				const times = await getBookedSlots(selectedServiceId, selectedDate);
				if (!cancelled) {
					setBookedSlotTimes(new Set(times));
				}
			} catch {
				if (!cancelled) {
					setBookedSlotTimes(new Set());
				}
			}
		}

		fetchBooked();

		return () => {
			cancelled = true;
		};
	}, [selectedServiceId, selectedDate, getBookedSlots]);

	const errors = useMemo(
		() => ({ ...stepErrors, ...formErrors }),
		[stepErrors, formErrors],
	);

	function isTimeSlotAvailable(startTime24, durMinutes) {
		if (bookedSlotTimes.size === 0) return true;
		const times = getConsecutiveSlotTimes(startTime24, durMinutes);
		return !times.some((t) => bookedSlotTimes.has(t));
	}

	return {
		step,
		direction,
		selectedServiceId,
		selectedService,
		selectedDuration,
		selectedDate,
		selectedTime,
		durationMinutes,
		durationLabel,
		errors,
		formErrors,
		hasSubmittedRef,
		pending,
		stepMeta,
		services,
		steps: STEPS,
		durationOptions: DURATION_OPTIONS,
		bookedSlotTimes,
		isTimeSlotAvailable,
		goToStep,
		handleNext,
		handleBack,
		handleSubmit,
		setSelectedServiceId,
		setSelectedDuration,
		setSelectedDate,
		setSelectedTime,
		formatTimeDisplay,
		getEndTime,
	};
}
