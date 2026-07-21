"use client";

import { Input, Label, Textarea } from "@techstream/quark-ui";

export default function CustomerForm({ errors = {}, hasSubmittedRef }) {
	const hasSubmitted = hasSubmittedRef ? hasSubmittedRef.current : false;

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<div className="space-y-2">
				<Label htmlFor="book-name">Name</Label>
				<Input
					id="book-name"
					name="name"
					placeholder="John Smith"
					className={hasSubmitted && errors.name ? "border-red-500" : ""}
				/>
				{hasSubmitted && errors.name && (
					<p className="text-sm text-red-500">{errors.name[0]}</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="book-email">Email</Label>
				<Input
					id="book-email"
					name="email"
					type="email"
					placeholder="john@example.com"
					className={hasSubmitted && errors.email ? "border-red-500" : ""}
				/>
				{hasSubmitted && errors.email && (
					<p className="text-sm text-red-500">{errors.email[0]}</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="book-phone">Phone (optional)</Label>
				<Input
					id="book-phone"
					name="phone"
					type="tel"
					placeholder="(555) 123-4567"
					className={hasSubmitted && errors.phone ? "border-red-500" : ""}
				/>
				{hasSubmitted && errors.phone && (
					<p className="text-sm text-red-500">{errors.phone[0]}</p>
				)}
			</div>

			<div className="space-y-2 sm:col-span-2">
				<Label htmlFor="book-notes">Notes (optional)</Label>
				<Textarea
					id="book-notes"
					name="notes"
					placeholder="Any special requests or notes..."
					rows={3}
					className={hasSubmitted && errors.notes ? "border-red-500" : ""}
				/>
				{hasSubmitted && errors.notes && (
					<p className="text-sm text-red-500">{errors.notes[0]}</p>
				)}
			</div>
		</div>
	);
}
