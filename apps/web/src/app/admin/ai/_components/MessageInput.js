"use client";

import { useEffect, useRef, useState } from "react";

export default function MessageInput({ onSend, disabled, placeholder }) {
	const [value, setValue] = useState("");
	const textareaRef = useRef(null);

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
		}
	});

	const handleSubmit = () => {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setValue("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	};

	const handleKeyDown = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	return (
		<div className="border-t border-border bg-bg p-4">
			<div className="max-w-3xl mx-auto">
				<div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors">
					<textarea
						ref={textareaRef}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={placeholder ?? "Ask anything about your data..."}
						disabled={disabled}
						rows={1}
						className="flex-1 bg-transparent resize-none text-sm text-text placeholder:text-text-faint focus:outline-none min-h-[24px] max-h-[160px] py-1"
					/>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={disabled || !value.trim()}
						className="shrink-0 p-1.5 rounded-lg text-primary hover:bg-primary/10 disabled:text-text-faint disabled:hover:bg-transparent transition-colors"
						aria-label="Send message"
					>
						<svg
							aria-hidden="true"
							className="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M5 12h14M12 5l7 7-7 7"
							/>
						</svg>
					</button>
				</div>
				<p className="text-[11px] text-text-faint mt-1.5 text-center">
					Press Enter to send, Shift+Enter for new line
				</p>
			</div>
		</div>
	);
}
