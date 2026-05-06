"use client";

import { Button, Dialog } from "@techstream/quark-ui";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * Overlay delete button for a media asset card.
 * Renders as an absolute-positioned icon button that appears on group-hover,
 * and opens a confirmation Dialog before calling the server action.
 *
 * @param {{ deleteAction: () => Promise<void> }} props
 */
export default function DeleteMediaButton({ deleteAction }) {
	const [open, setOpen] = useState(false);
	const [isDeleting, startTransition] = useTransition();

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="absolute top-1.5 right-1.5 flex items-center justify-center w-7 h-7 rounded-[--radius-default] bg-danger/80 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
				aria-label="Delete asset"
			>
				<Trash2
					aria-hidden="true"
					className="w-3.5 h-3.5 shrink-0"
					strokeWidth={2}
				/>
			</button>
			<Dialog open={open} onClose={() => setOpen(false)} title="Delete asset">
				<div className="space-y-4">
					<p className="text-sm">
						Delete this media asset? This cannot be undone and may break any
						content referencing it.
					</p>
					<div className="flex gap-2 justify-end pt-4 border-t border-border -mx-5 px-5">
						<Button
							variant="secondary"
							onClick={() => setOpen(false)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="danger"
							disabled={isDeleting}
							onClick={() => {
								startTransition(async () => {
									await deleteAction();
									setOpen(false);
								});
							}}
						>
							{isDeleting ? "Deleting\u2026" : "Delete asset"}
						</Button>
					</div>
				</div>
			</Dialog>
		</>
	);
}
