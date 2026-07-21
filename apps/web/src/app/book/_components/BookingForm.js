"use client";

import { useBooking } from "@techstream/quark-bookings/use-booking";
import { Button } from "@techstream/quark-ui";
import CalendarPicker from "./CalendarPicker.js";
import CustomerForm from "./CustomerForm.js";
import ServiceSelector from "./ServiceSelector.js";
import TimeSlotPicker from "./TimeSlotPicker.js";

function StepIndicator({ step, steps }) {
	const progress = ((step - 1) / (steps.length - 1)) * 100;

	return (
		<div className="relative mb-10">
			<div className="absolute top-4 left-0 right-0 h-0.5 bg-border rounded-full" />
			<div
				className="absolute top-4 left-0 h-0.5 bg-primary rounded-full transition-all duration-700 ease-out"
				style={{ width: `${progress}%` }}
			/>
			<div className="relative flex justify-between">
				{steps.map((s) => {
					const isComplete = s.num < step;
					const isCurrent = s.num === step;
					return (
						<div key={s.num} className="flex flex-col items-center gap-2">
							<div
								className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-500 ${
									isComplete
										? "bg-primary text-white scale-100"
										: isCurrent
											? "bg-primary text-white ring-4 ring-primary/20 scale-110"
											: "bg-surface text-text-muted border-2 border-border"
								}`}
							>
								{isComplete ? (
									<svg
										className="h-4 w-4 animate-in zoom-in duration-200"
										viewBox="0 0 20 20"
										fill="currentColor"
										aria-hidden="true"
									>
										<path
											fillRule="evenodd"
											d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
											clipRule="evenodd"
										/>
									</svg>
								) : (
									s.num
								)}
							</div>
							<span
								className={`text-xs font-medium transition-colors duration-300 ${isCurrent ? "text-primary" : "text-text-muted"}`}
							>
								{s.label}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export default function BookingForm({ services, action, getBookedSlots }) {
	const booking = useBooking({ services, action, getBookedSlots });

	const {
		step,
		direction,
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
		steps,
		durationOptions,
		isTimeSlotAvailable,
		handleNext,
		handleBack,
		handleSubmit,
		setSelectedServiceId,
		setSelectedDuration,
		setSelectedDate,
		setSelectedTime,
		formatTimeDisplay,
		getEndTime,
	} = booking;

	const selectedServiceId = booking.selectedServiceId;

	return (
		<form>
			<StepIndicator step={step} steps={steps} />

			<div className="relative overflow-hidden">
				{step === 1 && (
					<div
						key="step-1"
						className={
							direction === 1 ? "animate-slide-in" : "animate-slide-in-back"
						}
					>
						<div className="mb-8">
							<h2 className="text-xl font-semibold text-text">
								{stepMeta.title}
							</h2>
							<p className="text-sm text-text-muted mt-1">{stepMeta.desc}</p>
						</div>
						<ServiceSelector
							services={services}
							selectedId={selectedServiceId || ""}
							onSelect={(id) => {
								setSelectedServiceId(id);
							}}
							error={errors.serviceTypeId}
						/>
					</div>
				)}

				{step === 2 && (
					<div
						key="step-2"
						className={
							direction === 1 ? "animate-slide-in" : "animate-slide-in-back"
						}
					>
						<div className="mb-8">
							<h2 className="text-xl font-semibold text-text">
								{stepMeta.title}
							</h2>
							<p className="text-sm text-text-muted mt-1">
								{selectedService?.name ? (
									<>
										<span className="font-medium text-text">
											{selectedService.name}
										</span>
										{" — "}how long would you like to book?
									</>
								) : (
									"How long would you like to book?"
								)}
							</p>
						</div>

						<div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
							{durationOptions.map((opt) => {
								const isSelected = selectedDuration === opt.value;
								const price =
									selectedService?.price != null && selectedService.price > 0
										? selectedService.price *
											(Number.parseInt(opt.value, 10) / 30)
										: null;

								return (
									<button
										key={opt.value}
										type="button"
										onClick={() => setSelectedDuration(opt.value)}
										className={`group rounded-[--radius-default] border p-4 text-center transition-all duration-200 cursor-pointer ${
											isSelected
												? "border-primary bg-primary-muted/30 shadow-[0_0_0_1px_var(--color-primary)] shadow-primary/30"
												: "border-border bg-surface hover:border-primary/40 hover:shadow-[0_4px_12px_rgba(55,125,255,0.08)]"
										}`}
									>
										<p
											className={`text-lg font-bold transition-colors ${isSelected ? "text-primary" : "text-text"}`}
										>
											{opt.label}
										</p>
										{price != null && (
											<p
												className={`text-sm mt-1 transition-colors ${isSelected ? "text-primary" : "text-text-muted"}`}
											>
												${price.toFixed(2)}
											</p>
										)}
									</button>
								);
							})}
						</div>

						<input type="hidden" name="duration" value={selectedDuration} />
					</div>
				)}

				{step === 3 && (
					<div
						key="step-3"
						className={
							direction === 1 ? "animate-slide-in" : "animate-slide-in-back"
						}
					>
						<div className="mb-8">
							<h2 className="text-xl font-semibold text-text">
								{stepMeta.title}
							</h2>
							<p className="text-sm text-text-muted mt-1">
								{selectedService?.name && (
									<span className="font-medium text-text">
										{selectedService.name}
									</span>
								)}
								{" — "}
								{durationLabel}. Pick your date and start time.
							</p>
						</div>

						<div className="grid gap-6 lg:grid-cols-[1fr_300px]">
							<CalendarPicker
								selectedDate={selectedDate}
								onSelect={(dateStr) => {
									setSelectedDate(dateStr);
									setSelectedTime("");
								}}
								error={errors.date}
							/>

							<div className="space-y-5">
								{selectedDate ? (
									<div className="space-y-2">
										<span className="block text-sm font-medium text-text">
											Available Time Slots
										</span>
										<TimeSlotPicker
											selectedDate={selectedDate}
											selectedTime={selectedTime}
											duration={selectedDuration}
											isTimeSlotAvailable={isTimeSlotAvailable}
											onSelect={(time) => {
												setSelectedTime(time);
											}}
										/>
										{errors.startTime && (
											<p className="text-sm text-red-500">
												{errors.startTime[0]}
											</p>
										)}
									</div>
								) : (
									<p className="text-sm text-text-muted py-2">
										Pick a date to see available times.
									</p>
								)}
							</div>
						</div>
					</div>
				)}

				{step === 4 && (
					<div
						key="step-4"
						className={
							direction === 1 ? "animate-slide-in" : "animate-slide-in-back"
						}
					>
						<div className="mb-8">
							<h2 className="text-xl font-semibold text-text">
								{stepMeta.title}
							</h2>
							<p className="text-sm text-text-muted mt-1">{stepMeta.desc}</p>
						</div>

						{selectedService && selectedDate && selectedTime && (
							<div className="mb-8 rounded-[--radius-default] border border-primary/25 bg-gradient-to-r from-primary-muted/30 to-primary-muted/10 p-5">
								<div className="flex items-start gap-4">
									<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
										<svg
											className="h-5 w-5"
											viewBox="0 0 20 20"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
											<path d="M10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
										</svg>
									</div>
									<div className="min-w-0 space-y-1.5">
										<p className="text-sm font-semibold text-text">
											{selectedService.name}
										</p>
										<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
											<span className="inline-flex items-center gap-1.5">
												<svg
													className="h-3.5 w-3.5 shrink-0 text-primary"
													viewBox="0 0 20 20"
													fill="currentColor"
													aria-hidden="true"
												>
													<path
														fillRule="evenodd"
														d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v8H4V8z"
														clipRule="evenodd"
													/>
												</svg>
												{new Date(
													`${selectedDate}T12:00:00`,
												).toLocaleDateString("en-US", {
													weekday: "short",
													month: "short",
													day: "numeric",
												})}
											</span>
											<span className="inline-flex items-center gap-1.5">
												<svg
													className="h-3.5 w-3.5 shrink-0 text-primary"
													viewBox="0 0 20 20"
													fill="currentColor"
													aria-hidden="true"
												>
													<path
														fillRule="evenodd"
														d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
														clipRule="evenodd"
													/>
												</svg>
												{formatTimeDisplay(selectedTime)} –{" "}
												{formatTimeDisplay(
													getEndTime(selectedTime, durationMinutes),
												)}
											</span>
											{selectedService.price != null &&
												selectedService.price > 0 && (
													<span className="inline-flex items-center gap-1.5 font-semibold text-primary">
														$
														{(
															selectedService.price *
															(durationMinutes / 30)
														).toFixed(2)}
													</span>
												)}
										</div>
									</div>
								</div>
							</div>
						)}

						<CustomerForm
							errors={formErrors}
							hasSubmittedRef={hasSubmittedRef}
						/>

						{formErrors._form && (
							<p className="text-sm text-red-500 mt-4">{formErrors._form[0]}</p>
						)}
					</div>
				)}
			</div>

			<div className="flex items-center justify-between gap-3 pt-6 border-t border-border mt-10">
				<div>
					{step > 1 && (
						<Button
							type="button"
							variant="secondary"
							onClick={handleBack}
							size="lg"
						>
							Back
						</Button>
					)}
				</div>
				<div>
					{step < steps.length ? (
						<Button
							type="button"
							variant="solid"
							onClick={handleNext}
							size="lg"
						>
							{step === 1 ? "Continue" : "Next"}
						</Button>
					) : (
						<Button
							type="button"
							variant="solid"
							disabled={pending}
							size="lg"
							onClick={handleSubmit}
						>
							{pending ? "Booking..." : "Confirm Booking"}
						</Button>
					)}
				</div>
			</div>
		</form>
	);
}
