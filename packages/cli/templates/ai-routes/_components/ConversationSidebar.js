"use client";

import { useEffect, useRef } from "react";
import ConversationItem from "./ConversationItem";

function ResizeHandle({ onResize, onToggleCollapse }) {
	const handleRef = useRef(null);
	const isResizing = useRef(false);

	useEffect(() => {
		const handle = handleRef.current;
		if (!handle) return;

		const onMouseDown = (e) => {
			isResizing.current = true;
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			e.preventDefault();
		};

		const onMouseMove = (e) => {
			if (!isResizing.current) return;
			const newWidth = Math.max(200, Math.min(480, e.clientX));
			onResize(newWidth);
		};

		const onMouseUp = () => {
			if (isResizing.current) {
				isResizing.current = false;
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			}
		};

		handle.addEventListener("mousedown", onMouseDown);
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);

		return () => {
			handle.removeEventListener("mousedown", onMouseDown);
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};
	}, [onResize]);

	return (
		<button
			type="button"
			ref={handleRef}
			className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:w-1.5 hover:bg-primary/30 active:bg-primary/50 transition-all duration-150 z-10"
			aria-label="Resize sidebar"
			onKeyDown={(e) => {
				if (e.key === "ArrowLeft") onResize((w) => Math.max(200, w - 20));
				if (e.key === "ArrowRight") onResize((w) => Math.min(480, w + 20));
				if (e.key === "Escape") onToggleCollapse();
			}}
		/>
	);
}

export default function ConversationSidebar({
	width,
	onResize,
	collapsed,
	onToggleCollapse,
	conversations,
	activeId,
	onSelect,
	onNew,
	onDelete,
	onRename,
}) {
	const scrollRef = useRef(null);

	const prevConversationCount = useRef(0);
	useEffect(() => {
		if (
			scrollRef.current &&
			conversations.length !== prevConversationCount.current
		) {
			scrollRef.current.scrollTop = 0;
			prevConversationCount.current = conversations.length;
		}
	}, [conversations.length]);

	return (
		<div
			className="relative flex flex-col bg-surface border-r border-border shrink-0 transition-[width] duration-200 ease-in-out"
			style={{
				width: collapsed ? 0 : width,
				overflow: collapsed ? "hidden" : "visible",
			}}
		>
			{!collapsed && (
				<>
					<div className="flex items-center justify-between p-3 border-b border-border shrink-0">
						<h2 className="text-sm font-semibold text-text truncate">
							Conversations
						</h2>
						<button
							type="button"
							onClick={onToggleCollapse}
							className="p-1 rounded hover:bg-surface-hover text-text-faint hover:text-text transition-colors"
							aria-label="Collapse sidebar"
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
									d="M11 19l-7-7 7-7M18 19l-7-7 7-7"
								/>
							</svg>
						</button>
					</div>

					<div className="p-3 shrink-0">
						<button
							type="button"
							onClick={onNew}
							className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
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
									d="M12 4v16m8-8H4"
								/>
							</svg>
							New conversation
						</button>
					</div>

					<div ref={scrollRef} className="flex-1 overflow-y-auto px-2 pb-2">
						{conversations.length === 0 ? (
							<p className="text-xs text-text-faint text-center py-8">
								No conversations yet
							</p>
						) : (
							<div className="space-y-0.5">
								{conversations.map((conv) => (
									<ConversationItem
										key={conv.id}
										conversation={conv}
										isActive={conv.id === activeId}
										onSelect={onSelect}
										onDelete={onDelete}
										onRename={onRename}
									/>
								))}
							</div>
						)}
					</div>
				</>
			)}

			{collapsed && (
				<button
					type="button"
					onClick={onToggleCollapse}
					className="absolute top-3 left-0 p-1.5 rounded-r-lg bg-surface border border-l-0 border-border text-text-faint hover:text-text hover:bg-surface-hover transition-colors z-20"
					aria-label="Expand sidebar"
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
							d="M13 5l7 7-7 7M5 5l7 7-7 7"
						/>
					</svg>
				</button>
			)}

			<ResizeHandle onResize={onResize} onToggleCollapse={onToggleCollapse} />
		</div>
	);
}
