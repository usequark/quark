"use client";

import { useEffect, useRef, useState } from "react";

export default function ConversationItem({
	conversation,
	isActive,
	onSelect,
	onDelete,
	onRename,
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editTitle, setEditTitle] = useState(conversation.title);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const inputRef = useRef(null);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const handleDoubleClick = () => {
		setEditTitle(conversation.title);
		setIsEditing(true);
	};

	const handleRenameSubmit = () => {
		const trimmed = editTitle.trim();
		if (trimmed && trimmed !== conversation.title) {
			onRename(conversation.id, trimmed);
		}
		setIsEditing(false);
	};

	const handleRenameKeyDown = (e) => {
		if (e.key === "Enter") {
			handleRenameSubmit();
		}
		if (e.key === "Escape") {
			setEditTitle(conversation.title);
			setIsEditing(false);
		}
	};

	const handleDelete = (e) => {
		e.stopPropagation();
		if (showDeleteConfirm) {
			onDelete(conversation.id);
			setShowDeleteConfirm(false);
		} else {
			setShowDeleteConfirm(true);
			setTimeout(() => setShowDeleteConfirm(false), 3000);
		}
	};

	const messageCount = conversation._count?.messages ?? 0;
	const updatedAt = conversation.updatedAt
		? new Date(conversation.updatedAt).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			})
		: "";

	return (
		<button
			type="button"
			onClick={() => onSelect(conversation.id)}
			onDoubleClick={handleDoubleClick}
			className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group ${
				isActive
					? "bg-surface-hover text-text"
					: "text-text-muted hover:bg-surface-hover hover:text-text"
			}`}
		>
			<div className="flex items-start justify-between gap-2">
				{isEditing ? (
					<input
						ref={inputRef}
						type="text"
						value={editTitle}
						onChange={(e) => setEditTitle(e.target.value)}
						onBlur={handleRenameSubmit}
						onKeyDown={handleRenameKeyDown}
						className="flex-1 bg-surface border border-border rounded px-2 py-0.5 text-sm text-text focus:outline-none focus:border-primary"
						onClick={(e) => e.stopPropagation()}
					/>
				) : (
					<span className="text-sm truncate flex-1">{conversation.title}</span>
				)}
				{!isEditing && (
					<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
						{showDeleteConfirm ? (
							<button
								type="button"
								onClick={handleDelete}
								className="text-xs text-danger hover:text-danger/80 px-1.5 py-0.5 rounded hover:bg-danger/10 transition-colors"
							>
								Confirm
							</button>
						) : (
							<button
								type="button"
								onClick={handleDelete}
								className="p-0.5 rounded hover:bg-surface text-text-faint hover:text-danger transition-colors"
								aria-label="Delete conversation"
							>
								<svg
									aria-hidden="true"
									className="w-3.5 h-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						)}
					</div>
				)}
			</div>
			<div className="flex items-center gap-2 mt-1">
				<span className="text-[11px] text-text-faint">
					{messageCount} {messageCount === 1 ? "message" : "messages"}
				</span>
				{updatedAt && (
					<>
						<span className="text-text-faint">·</span>
						<span className="text-[11px] text-text-faint">{updatedAt}</span>
					</>
				)}
			</div>
		</button>
	);
}
