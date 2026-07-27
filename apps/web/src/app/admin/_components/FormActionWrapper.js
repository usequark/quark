"use client";

import { Button } from "@techstream/quark-ui";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * Wraps a server-action form with loading spinner and success/error feedback.
 *
 * Usage:
 *   <FormActionWrapper
 *     action={updateRecord.bind(null, id)}
 *     buttonLabel="Save Changes"
 *     successMessage="Record saved."
 *   >
 *     <input name="name" ... />
 *   </FormActionWrapper>
 */
export default function FormActionWrapper({
	action,
	children,
	buttonLabel = "Save",
	successMessage = "Saved successfully.",
	className = "",
}) {
	const router = useRouter();
	const [isPending, setIsPending] = useState(false);
	const [feedback, setFeedback] = useState(null);

	const handleSubmit = useCallback(
		async (e) => {
			e.preventDefault();
			setIsPending(true);
			setFeedback(null);

			try {
				const formData = new FormData(e.target);
				const result = await action(formData);

				if (result && typeof result === "object" && result.success === false) {
					setFeedback({
						type: "error",
						message: result.error ?? "Action failed.",
					});
				} else {
					setFeedback({ type: "success", message: successMessage });
				}
			} catch (err) {
				// Re-throw Next.js navigation errors (redirect/notFound)
				if (
					err?.digest?.startsWith("NEXT_REDIRECT") ||
					err?.digest?.startsWith("NEXT_NOT_FOUND")
				) {
					throw err;
				}
				setFeedback({
					type: "error",
					message: err?.message ?? "Something went wrong.",
				});
			} finally {
				setIsPending(false);
				router.refresh();
			}
		},
		[action, successMessage, router],
	);

	return (
		<form onSubmit={handleSubmit} className={className}>
			{feedback && (
				<div
					className={`mb-4 px-4 py-2 rounded text-sm ${
						feedback.type === "success"
							? "bg-success/10 text-success border border-success/20"
							: "bg-danger/10 text-danger border border-danger/20"
					}`}
				>
					{feedback.message}
				</div>
			)}

			{children}

			<div className="flex justify-end pt-2">
				<Button variant="solid" type="submit" loading={isPending}>
					{isPending ? "Saving…" : buttonLabel}
				</Button>
			</div>
		</form>
	);
}
