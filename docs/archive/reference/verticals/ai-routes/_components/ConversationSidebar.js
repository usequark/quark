"use client";

import { useEffect, useRef } from "react";
import ConversationItem from "./ConversationItem";

function ResizeHandle({ onResize, onToggleCollapse, currentWidth }) {
	const handleRef = useRef(null);
	const isResizing = useRef(false);
	const onResizeRef = useRef(onResize);

	useEffect(() => {
		onResizeRef.current = onResize;
	}, [onResize]);

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
			onResizeRef.current(newWidth);
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
	}, []);

	return (
		<button
			type="button"
			ref={handleRef}
			className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:w-1.5 hover:bg-primary/30 active:bg-primary/50 transition-all duration-150 z-10"
			aria-label="Resize sidebar"
			onKeyDown={(e) => {
				if (e.key === "ArrowLeft") onResize(Math.max(200, currentWidth - 20));
				if (e.key === "ArrowRight") onResize(Math.min(480, currentWidth + 20));
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
	pendingTitleIds,
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
			className="relative flex flex-col bg-surface border-r border-border shrink-0 p-4 transition-[width] duration-200 ease-in-out"
			style={{
				width: collapsed ? 72 : width,
				overflow: collapsed ? "visible" : "visible",
			}}
		>
			{!collapsed && (
				<>
					<div className="mb-4 flex items-center gap-2 px-3 shrink-0">
						<h2 className="text-sm font-semibold text-text truncate flex-1">
							Conversations
						</h2>
						<button
							type="button"
							onClick={onToggleCollapse}
							className="p-2 rounded hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
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
									d="M15 19l-7-7 7-7"
								/>
							</svg>
						</button>
					</div>

					<div className="px-0 pb-3 shrink-0">
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

					<div ref={scrollRef} className="flex-1 overflow-y-auto px-0 pb-2">
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
										isTitlePending={pendingTitleIds?.includes(conv.id)}
									/>
								))}
							</div>
						)}
					</div>
				</>
			)}

			{collapsed && (
				<>
					<button
						type="button"
						onClick={onToggleCollapse}
						className="absolute top-4 left-1/2 -translate-x-1/2 p-2 rounded text-text-muted hover:bg-surface-hover hover:text-text transition-colors z-20"
						aria-label="Expand sidebar"
						title="Expand sidebar"
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
								d="M9 18l6-6-6-6"
							/>
						</svg>
					</button>

					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onNew();
						}}
						className="absolute top-[60px] left-1/2 -translate-x-1/2 p-2 rounded text-text-muted hover:bg-surface-hover hover:text-text transition-colors z-20"
						aria-label="New conversation"
						title="New conversation"
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
					</button>

					{/* Session initial avatars in collapsed state */}
					<div className="absolute top-[116px] left-1/2 -translate-x-1/2 flex flex-col gap-3 items-center z-20">
						{conversations.length > 0 &&
							conversations
								.slice(0, Math.min(5, conversations.length))
								.map((conv) => {
									const initial = (conv.title || "?")[0].toUpperCase();
									const isActive = conv.id === activeId;
									const isPending = pendingTitleIds?.includes(conv.id);

									if (isPending) {
										return (
											<div
												key={conv.id}
												className="w-7 h-7 rounded-full bg-primary/20 animate-pulse"
												title="Generating response..."
											/>
										);
									}

									return (
										<button
											key={conv.id}
											type="button"
											onClick={() => onSelect(conv.id)}
											className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
												isActive
													? "bg-primary text-white shadow-sm"
													: "border border-text-faint/30 text-text-faint hover:border-text-faint hover:text-text"
											}`}
											aria-label={`Switch to ${conv.title || "conversation"}`}
											title={conv.title || "Conversation"}
										>
											{initial}
										</button>
									);
								})}
						{conversations.length > 5 && (
							<span className="text-[10px] text-text-faint font-medium">
								+{conversations.length - 5}
							</span>
						)}
					</div>
				</>
			)}

			{!collapsed && (
				<ResizeHandle
					onResize={onResize}
					onToggleCollapse={onToggleCollapse}
					currentWidth={width}
				/>
			)}
		</div>
	);
}
