"use client";

import { crmConfig } from "@techstream/quark-crm";
import { Button, Input, Label, Select, Textarea } from "@techstream/quark-ui";
import Link from "next/link";
import { useActionState } from "react";
import { createDeal, updateDeal } from "../_actions/deals";

export default function DealForm({ deal, contacts, companies }) {
	const action = deal ? updateDeal.bind(null, deal.id) : createDeal;
	const [state, dispatch] = useActionState(action, {});

	const stageDefs = crmConfig.pipelineStages;
	const errors = state?.errors ?? {};

	return (
		<form action={dispatch} className="space-y-6">
			<div className="space-y-4 max-w-xl">
				<FieldWrapper label="Title" error={errors.title}>
					<Input
						name="title"
						defaultValue={deal?.title ?? ""}
						required
						placeholder="e.g. Enterprise deal"
					/>
				</FieldWrapper>

				<div className="grid grid-cols-2 gap-4">
					<FieldWrapper label="Value" error={errors.value}>
						<Input
							name="value"
							type="number"
							min="0"
							step="0.01"
							defaultValue={deal ? String(deal.value) : "0"}
							placeholder="0.00"
						/>
					</FieldWrapper>

					<FieldWrapper label="Probability (%)" error={errors.probability}>
						<Input
							name="probability"
							type="number"
							min="0"
							max="100"
							defaultValue={deal?.probability ?? 10}
						/>
					</FieldWrapper>
				</div>

				<FieldWrapper label="Stage" error={errors.stage}>
					<Select name="stage" defaultValue={deal?.stage ?? "LEAD"}>
						{stageDefs.map((s) => (
							<option key={s.key} value={s.key}>
								{s.label} ({s.probability}%)
							</option>
						))}
					</Select>
				</FieldWrapper>

				<FieldWrapper
					label="Expected Close Date"
					error={errors.expectedCloseDate}
				>
					<Input
						name="expectedCloseDate"
						type="date"
						defaultValue={
							deal?.expectedCloseDate
								? new Date(deal.expectedCloseDate).toISOString().split("T")[0]
								: ""
						}
					/>
				</FieldWrapper>

				<FieldWrapper label="Contact" error={errors.contactId}>
					<Select name="contactId" defaultValue={deal?.contactId ?? ""}>
						<option value="">No contact</option>
						{contacts.map((c) => (
							<option key={c.id} value={c.id}>
								{c.firstName} {c.lastName}
								{c.company ? ` (${c.company.name})` : ""}
							</option>
						))}
					</Select>
				</FieldWrapper>

				<FieldWrapper label="Company" error={errors.companyId}>
					<Select name="companyId" defaultValue={deal?.companyId ?? ""}>
						<option value="">No company</option>
						{companies.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
					</Select>
				</FieldWrapper>

				<FieldWrapper label="Notes" error={errors.notes}>
					<Textarea
						name="notes"
						defaultValue={deal?.notes ?? ""}
						rows={4}
						placeholder="Any additional notes..."
					/>
				</FieldWrapper>
			</div>

			<div className="flex items-center gap-3 pt-4 border-t border-border">
				<Button type="submit">{deal ? "Save Changes" : "Create Deal"}</Button>
				<Link
					href="/admin/crm/deals"
					className="text-sm text-text-muted hover:text-text"
				>
					Cancel
				</Link>
			</div>
		</form>
	);
}

function FieldWrapper({ label, error, children }) {
	return (
		<div>
			<Label>{label}</Label>
			{children}
			{error && (
				<p className="text-xs text-red-500 mt-1">
					{Array.isArray(error) ? error[0] : error}
				</p>
			)}
		</div>
	);
}
