"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import ChatArea from "./ChatArea";
import ConversationSidebar from "./ConversationSidebar";
import ImportBanner from "./ImportBanner";

const SIDEBAR_WIDTH_KEY = "ai-sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "ai-sidebar-collapsed";
const LEGACY_HISTORY_KEY = "ts-ai-chat-history";

const initialState = {
	conversations: [],
	activeConversationId: null,
	messages: [],
	sidebarWidth: 280,
	sidebarCollapsed: false,
	streaming: false,
	streamingContent: "",
	streamingAction: null,
	streamingThinking: null,
	toolProposal: null,
	showImport: false,
	pendingTitleIds: [],
};

function reducer(state, action) {
	switch (action.type) {
		case "SET_CONVERSATIONS":
			return { ...state, conversations: action.payload };
		case "SET_ACTIVE_CONVERSATION":
			return { ...state, activeConversationId: action.payload };
		case "SET_MESSAGES":
			return { ...state, messages: action.payload };
		case "SET_SIDEBAR_WIDTH":
			return { ...state, sidebarWidth: action.payload };
		case "SET_SIDEBAR_COLLAPSED":
			return { ...state, sidebarCollapsed: action.payload };
		case "START_STREAMING":
			return {
				...state,
				streaming: true,
				streamingContent: "",
				streamingAction: null,
				streamingThinking: null,
				toolProposal: null,
			};
		case "UPDATE_STREAMING_CONTENT":
			return { ...state, streamingContent: action.payload };
		case "SET_STREAMING_ACTION":
			return {
				...state,
				streamingAction: action.payload,
				streamingThinking: null,
			};
		case "SET_STREAMING_THINKING":
			return {
				...state,
				streamingThinking: action.payload,
				streamingAction: null,
			};
		case "STOP_STREAMING":
			return {
				...state,
				streaming: false,
				streamingContent: "",
				streamingAction: null,
				streamingThinking: null,
				toolProposal: null,
			};
		case "SET_TOOL_PROPOSAL":
			return { ...state, toolProposal: action.payload };
		case "CLEAR_TOOL_PROPOSAL":
			return { ...state, toolProposal: null };
		case "ADD_MESSAGE": {
			const convId = action.conversationId;
			return {
				...state,
				messages: [...state.messages, action.payload],
				conversations: convId
					? state.conversations.map((c) =>
							c.id === convId
								? {
										...c,
										messageCount:
											(c.messageCount ?? c._count?.messages ?? 0) + 1,
									}
								: c,
						)
					: state.conversations,
			};
		}
		case "REMOVE_TEMP_MESSAGE":
			return {
				...state,
				messages: state.messages.filter((m) => m.id !== action.payload),
			};
		case "SET_SHOW_IMPORT":
			return { ...state, showImport: action.payload };
		case "UPDATE_CONVERSATION_TITLE":
			return {
				...state,
				conversations: state.conversations.map((c) =>
					c.id === action.payload.id
						? { ...c, title: action.payload.title }
						: c,
				),
			};
		case "ADD_PENDING_TITLE":
			if (state.pendingTitleIds.includes(action.payload)) return state;
			return {
				...state,
				pendingTitleIds: [...state.pendingTitleIds, action.payload],
			};
		case "REMOVE_PENDING_TITLE":
			return {
				...state,
				pendingTitleIds: state.pendingTitleIds.filter(
					(id) => id !== action.payload,
				),
			};
		default:
			return state;
	}
}

function getInitialSidebarWidth() {
	if (typeof window === "undefined") return 280;
	try {
		const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
		if (stored) {
			const parsed = Number.parseInt(stored, 10);
			if (!Number.isNaN(parsed) && parsed >= 200 && parsed <= 480)
				return parsed;
		}
	} catch {}
	return 280;
}

function getInitialSidebarCollapsed() {
	if (typeof window === "undefined") return false;
	try {
		return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
	} catch {}
	return false;
}

function hasLegacyHistory() {
	if (typeof window === "undefined") return false;
	try {
		const raw = localStorage.getItem(LEGACY_HISTORY_KEY);
		if (!raw) return false;
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) && parsed.length > 0;
	} catch {}
	return false;
}

export default function AiChatShell() {
	const [state, dispatch] = useReducer(reducer, {
		...initialState,
		sidebarWidth: getInitialSidebarWidth(),
		sidebarCollapsed: getInitialSidebarCollapsed(),
	});
	const [error, setError] = useState(null);
	const [isMobile, setIsMobile] = useState(false);
	const eventSourceRef = useRef(null);
	const pendingSessionRef = useRef(null);
	const errorHandledRef = useRef(false);
	const silentFailureTimerRef = useRef(null);
	const sendingRef = useRef(false);

	const hasActiveConversation = state.activeConversationId !== null;

	// Mobile detection
	useEffect(() => {
		const check = () => setIsMobile(window.innerWidth < 768);
		check();
		window.addEventListener("resize", check);
		return () => window.removeEventListener("resize", check);
	}, []);

	// Auto-collapse on mobile, auto-expand on desktop
	useEffect(() => {
		if (isMobile) {
			dispatch({ type: "SET_SIDEBAR_COLLAPSED", payload: true });
		} else {
			dispatch({ type: "SET_SIDEBAR_COLLAPSED", payload: false });
		}
	}, [isMobile]);

	// Cleanup silent failure timer when streaming stops
	useEffect(() => {
		if (!state.streaming) {
			if (silentFailureTimerRef.current) {
				clearTimeout(silentFailureTimerRef.current);
				silentFailureTimerRef.current = null;
			}
		}
	}, [state.streaming]);

	// Auto-dismiss errors after 5 seconds
	useEffect(() => {
		if (error) {
			const timer = setTimeout(() => setError(null), 5000);
			return () => clearTimeout(timer);
		}
	}, [error]);

	// Persist sidebar width
	useEffect(() => {
		try {
			localStorage.setItem(SIDEBAR_WIDTH_KEY, String(state.sidebarWidth));
		} catch {}
	}, [state.sidebarWidth]);

	// Persist sidebar collapsed
	useEffect(() => {
		try {
			localStorage.setItem(
				SIDEBAR_COLLAPSED_KEY,
				String(state.sidebarCollapsed),
			);
		} catch {}
	}, [state.sidebarCollapsed]);

	// Sync URL with active session
	useEffect(() => {
		if (state.activeConversationId) {
			window.history.replaceState(
				null,
				"",
				`/admin/ai?session=${state.activeConversationId}`,
			);
		} else {
			window.history.replaceState(null, "", "/admin/ai");
		}
	}, [state.activeConversationId]);

	const loadConversations = useCallback(async () => {
		try {
			const res = await fetch("/api/ai/conversations?take=100");
			if (!res.ok) return;
			const data = await res.json();
			dispatch({
				type: "SET_CONVERSATIONS",
				payload: data.data ?? data.conversations ?? [],
			});
		} catch {
			setError("Failed to load conversations. Please try again.");
		}
	}, []);

	// Check for legacy history
	useEffect(() => {
		dispatch({ type: "SET_SHOW_IMPORT", payload: hasLegacyHistory() });
	}, []);

	// Load conversations on mount
	useEffect(() => {
		loadConversations();
	}, [loadConversations]);

	// Restore session from URL on initial load
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const sessionId = params.get("session");
		if (sessionId) {
			pendingSessionRef.current = sessionId;
		}
	}, []);

	const selectConversation = useCallback(
		async (id) => {
			if (id === state.activeConversationId) return;
			dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: id });
			dispatch({ type: "STOP_STREAMING" });

			// Close any active SSE connection
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}

			try {
				const res = await fetch(`/api/ai/conversations/${id}`);
				if (!res.ok) {
					dispatch({ type: "SET_MESSAGES", payload: [] });
					setError("Failed to load conversation. Please try again.");
					return;
				}
				const data = await res.json();
				dispatch({
					type: "SET_MESSAGES",
					payload: data.messages ?? data.conversation?.messages ?? [],
				});
			} catch {
				dispatch({ type: "SET_MESSAGES", payload: [] });
				setError("Failed to load conversation. Please try again.");
			}
		},
		[state.activeConversationId],
	);

	// After conversations load, select the session from URL if present
	useEffect(() => {
		if (pendingSessionRef.current && state.conversations.length > 0) {
			const id = pendingSessionRef.current;
			pendingSessionRef.current = null;
			const exists = state.conversations.some((c) => c.id === id);
			if (exists) {
				selectConversation(id);
			}
		}
	}, [state.conversations, selectConversation]);

	const createConversation = useCallback(() => {
		// Don't create a DB record yet — wait until the user sends their first message.
		// The conversation will be auto-created in sendMessage when they type.
		dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: null });
		dispatch({ type: "SET_MESSAGES", payload: [] });
		dispatch({ type: "STOP_STREAMING" });
	}, []);

	const renameConversation = useCallback(
		async (id, title) => {
			try {
				const res = await fetch(`/api/ai/conversations/${id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title }),
				});
				if (!res.ok) {
					setError("Failed to rename conversation. Please try again.");
					return;
				}
				dispatch({
					type: "SET_CONVERSATIONS",
					payload: state.conversations.map((c) =>
						c.id === id ? { ...c, title } : c,
					),
				});
			} catch {
				setError("Failed to rename conversation. Please try again.");
			}
		},
		[state.conversations],
	);

	const deleteConversation = useCallback(
		async (id) => {
			try {
				const res = await fetch(`/api/ai/conversations/${id}`, {
					method: "DELETE",
				});
				if (!res.ok) {
					setError("Failed to delete conversation. Please try again.");
					return;
				}
				dispatch({
					type: "SET_CONVERSATIONS",
					payload: state.conversations.filter((c) => c.id !== id),
				});
				dispatch({ type: "REMOVE_PENDING_TITLE", payload: id });
				if (state.activeConversationId === id) {
					dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: null });
					dispatch({ type: "SET_MESSAGES", payload: [] });
				}
			} catch {
				setError("Failed to delete conversation. Please try again.");
			}
		},
		[state.activeConversationId, state.conversations],
	);

	const handleSSEEvent = useCallback(
		(data, eventSource, assistantContentRef, conversationId) => {
			switch (data.type) {
				case "thinking":
					dispatch({ type: "SET_STREAMING_THINKING", payload: data.content });
					break;
				case "action":
					dispatch({ type: "SET_STREAMING_ACTION", payload: data.action });
					break;
				case "action_complete":
					dispatch({ type: "SET_STREAMING_ACTION", payload: null });
					break;
				case "tool_proposal":
					dispatch({
						type: "SET_TOOL_PROPOSAL",
						payload: {
							toolName: data.toolName,
							input: data.input,
							callId: data.callId,
						},
					});
					break;
				case "tool_skipped":
					dispatch({ type: "CLEAR_TOOL_PROPOSAL" });
					dispatch({
						type: "SET_STREAMING_ACTION",
						payload: `Skipped ${data.toolName}${data.reason ? ` (${data.reason})` : ""}`,
					});
					break;
				case "message":
					assistantContentRef.current += data.content;
					dispatch({
						type: "UPDATE_STREAMING_CONTENT",
						payload: assistantContentRef.current,
					});
					break;
				case "title":
					dispatch({
						type: "REMOVE_PENDING_TITLE",
						payload: conversationId,
					});
					dispatch({
						type: "UPDATE_CONVERSATION_TITLE",
						payload: {
							id: conversationId,
							title: data.title,
						},
					});
					break;
				case "done":
					dispatch({
						type: "REMOVE_PENDING_TITLE",
						payload: conversationId,
					});
					eventSource.close();
					eventSourceRef.current = null;
					dispatch({
						type: "ADD_MESSAGE",
						payload: {
							id: `assistant-${Date.now()}`,
							role: "assistant",
							content: assistantContentRef.current,
						},
					});
					dispatch({ type: "STOP_STREAMING" });
					// Refresh conversation list to update title/message count
					loadConversations();
					break;
				case "error":
					dispatch({
						type: "REMOVE_PENDING_TITLE",
						payload: conversationId,
					});
					errorHandledRef.current = true;
					eventSource.close();
					eventSourceRef.current = null;
					dispatch({ type: "STOP_STREAMING" });
					setError(data.error || "AI request failed. Please try again.");
					loadConversations();
					break;
				case "timeout":
					dispatch({
						type: "REMOVE_PENDING_TITLE",
						payload: conversationId,
					});
					eventSource.close();
					eventSourceRef.current = null;
					dispatch({ type: "STOP_STREAMING" });
					setError("Request timed out. Please try again.");
					loadConversations();
					break;
			}
		},
		[loadConversations],
	);

	const sendMessage = useCallback(
		async (text) => {
			if (state.streaming) return;
			if (sendingRef.current) return;
			sendingRef.current = true;

			try {
				// Optimistically add user message immediately for instant feedback
				const userMsg = {
					id: `temp-${Date.now()}`,
					role: "user",
					content: text,
				};
				dispatch({
					type: "ADD_MESSAGE",
					payload: userMsg,
					conversationId: state.activeConversationId,
				});

				let conversationId = state.activeConversationId;

				// Auto-create conversation if none selected
				if (!conversationId) {
					try {
						const res = await fetch("/api/ai/conversations", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ title: "New conversation" }),
						});
						if (!res.ok) {
							dispatch({ type: "REMOVE_TEMP_MESSAGE", payload: userMsg.id });
							setError("Failed to create conversation. Please try again.");
							return;
						}
						const data = await res.json();
						const conv = data.data ?? data.conversation ?? data;
						dispatch({
							type: "SET_CONVERSATIONS",
							payload: [conv, ...state.conversations],
						});
						dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: conv.id });
						dispatch({ type: "ADD_PENDING_TITLE", payload: conv.id });
						conversationId = conv.id;
					} catch {
						dispatch({ type: "REMOVE_TEMP_MESSAGE", payload: userMsg.id });
						setError("Failed to create conversation. Please try again.");
						return;
					}
				}

				try {
					const res = await fetch("/api/ai/chat", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							conversationId,
							message: text,
						}),
					});

					if (!res.ok) {
						dispatch({ type: "REMOVE_TEMP_MESSAGE", payload: userMsg.id });
						dispatch({ type: "REMOVE_PENDING_TITLE", payload: conversationId });
						setError("Failed to send message. Please try again.");
						return;
					}
				} catch {
					dispatch({ type: "REMOVE_TEMP_MESSAGE", payload: userMsg.id });
					dispatch({ type: "REMOVE_PENDING_TITLE", payload: conversationId });
					setError("Failed to send message. Please try again.");
					return;
				}

				// Start SSE stream
				dispatch({ type: "START_STREAMING" });
				errorHandledRef.current = false;

				// Safety timeout: if no SSE events within 25s, show error
				// This catches silent failures where the AI worker finished and
				// published to Redis before the SSE subscriber existed.
				silentFailureTimerRef.current = setTimeout(() => {
					if (eventSourceRef.current) {
						eventSourceRef.current.close();
						eventSourceRef.current = null;
					}
					dispatch({ type: "REMOVE_PENDING_TITLE", payload: conversationId });
					dispatch({ type: "STOP_STREAMING" });
					setError(
						"The AI is taking longer than expected. Please try again or rephrase your question.",
					);
				}, 25_000);

				const assistantContentRef = { current: "" };

				const eventSource = new EventSource(
					`/api/ai/chat/stream?conversationId=${conversationId}`,
				);
				eventSourceRef.current = eventSource;

				eventSource.onmessage = (event) => {
					// Any SSE event proves the stream is alive — clear safety timer
					if (silentFailureTimerRef.current) {
						clearTimeout(silentFailureTimerRef.current);
						silentFailureTimerRef.current = null;
					}
					try {
						const data = JSON.parse(event.data);
						handleSSEEvent(
							data,
							eventSource,
							assistantContentRef,
							conversationId,
						);
					} catch {
						// Skip malformed events
					}
				};

				eventSource.onerror = () => {
					if (silentFailureTimerRef.current) {
						clearTimeout(silentFailureTimerRef.current);
						silentFailureTimerRef.current = null;
					}
					eventSource.close();
					eventSourceRef.current = null;
					dispatch({ type: "REMOVE_PENDING_TITLE", payload: conversationId });
					dispatch({ type: "STOP_STREAMING" });

					if (errorHandledRef.current) {
						// Error was already handled via SSE event stream — don't overwrite
						errorHandledRef.current = false;
					} else {
						setError("Connection lost. Please try again.");
					}
				};
			} finally {
				sendingRef.current = false;
			}
		},
		[
			state.activeConversationId,
			state.streaming,
			handleSSEEvent,
			state.conversations,
		],
	);

	const respondToToolProposal = useCallback(
		async (approved) => {
			const proposal = state.toolProposal;
			if (!proposal?.callId) return;

			dispatch({ type: "CLEAR_TOOL_PROPOSAL" });

			try {
				const res = await fetch(
					`/api/ai/tool-permissions/${encodeURIComponent(proposal.callId)}/confirm`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ approved }),
					},
				);
				if (!res.ok) {
					setError(
						approved
							? "Failed to approve tool. Please try again."
							: "Failed to deny tool. Please try again.",
					);
				}
			} catch {
				setError(
					approved
						? "Failed to approve tool. Please try again."
						: "Failed to deny tool. Please try again.",
				);
			}
		},
		[state.toolProposal],
	);

	const handleImport = useCallback(async () => {
		try {
			const raw = localStorage.getItem(LEGACY_HISTORY_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return;

			// Import sequentially with error tracking
			let successCount = 0;
			for (const conv of parsed) {
				try {
					const res = await fetch("/api/ai/conversations", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							title: conv.title ?? "Imported Conversation",
							messages: conv.messages ?? [],
						}),
					});
					if (res.ok) successCount++;
				} catch {
					// Track failure but continue importing
				}
			}

			if (successCount > 0) {
				localStorage.removeItem(LEGACY_HISTORY_KEY);
				dispatch({ type: "SET_SHOW_IMPORT", payload: false });
				loadConversations();
			}
		} catch {
			// Silently fail
		}
	}, [loadConversations]);

	const handleDismissImport = useCallback(() => {
		dispatch({ type: "SET_SHOW_IMPORT", payload: false });
		try {
			localStorage.removeItem(LEGACY_HISTORY_KEY);
		} catch {}
	}, []);

	return (
		<div className="flex flex-1 h-full overflow-hidden relative">
			{error && (
				<div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
					<div className="bg-danger-muted border border-danger/30 text-danger rounded-lg px-4 py-3 text-sm flex items-center justify-between shadow-md">
						<span>{error}</span>
						<button
							type="button"
							onClick={() => setError(null)}
							className="ml-2 text-danger/70 hover:text-danger"
						>
							✕
						</button>
					</div>
				</div>
			)}

			{state.showImport && (
				<div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4">
					<ImportBanner
						onImport={handleImport}
						onDismiss={handleDismissImport}
					/>
				</div>
			)}

			<ConversationSidebar
				width={state.sidebarWidth}
				onResize={(width) =>
					dispatch({ type: "SET_SIDEBAR_WIDTH", payload: width })
				}
				collapsed={state.sidebarCollapsed}
				onToggleCollapse={() =>
					dispatch({
						type: "SET_SIDEBAR_COLLAPSED",
						payload: !state.sidebarCollapsed,
					})
				}
				conversations={state.conversations}
				activeId={state.activeConversationId}
				onSelect={selectConversation}
				onNew={createConversation}
				onDelete={deleteConversation}
				onRename={renameConversation}
				pendingTitleIds={state.pendingTitleIds}
			/>
			<ChatArea
				messages={state.messages}
				onSend={sendMessage}
				streaming={state.streaming}
				streamingContent={state.streamingContent}
				streamingAction={state.streamingAction}
				streamingThinking={state.streamingThinking}
				toolProposal={state.toolProposal}
				onApproveTool={() => respondToToolProposal(true)}
				onDenyTool={() => respondToToolProposal(false)}
				hasActiveConversation={hasActiveConversation}
			/>
		</div>
	);
}
