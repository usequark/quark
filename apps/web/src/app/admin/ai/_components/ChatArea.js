"use client";

import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import StreamingIndicator from "./StreamingIndicator";

export default function ChatArea({
	messages,
	onSend,
	streaming,
	streamingContent,
	streamingAction,
	streamingThinking,
	hasActiveConversation,
}) {
	const scrollRef = useRef(null);
	const bottomRef = useRef(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom when messages or streaming content changes
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, streamingContent]);

	const hasMessages = messages.length > 0;

	return (
		<div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
			{!hasMessages && !streaming ? (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center max-w-md px-6">
						<div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary-muted border border-primary/20 flex items-center justify-center">
							<svg
								aria-hidden="true"
								className="w-6 h-6 text-primary"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
								/>
							</svg>
						</div>
						<h2 className="text-lg font-semibold text-text mb-1">
							AI Assistant
						</h2>
						<p className="text-sm text-text-muted leading-relaxed">
							Ask questions about your data, create tasks, search contacts, and
							more. The assistant has access to your CRM, contacts, and business
							context.
						</p>
					</div>
				</div>
			) : (
				<div ref={scrollRef} className="flex-1 overflow-y-auto">
					<div className="max-w-3xl mx-auto px-4 py-6">
						{messages.map((msg) => (
							<MessageBubble
								key={msg.id}
								message={msg}
								isStreaming={false}
								streamingContent=""
							/>
						))}

						{streaming && (
							<>
								{(streamingAction || streamingThinking) && (
									<div className="py-2">
										<StreamingIndicator
											action={streamingAction}
											thinking={streamingThinking}
										/>
									</div>
								)}
								{streamingContent && (
									<MessageBubble
										message={{
											id: "streaming",
											role: "assistant",
											content: streamingContent,
										}}
										isStreaming={true}
										streamingContent={streamingContent}
									/>
								)}
							</>
						)}

						<div ref={bottomRef} className="h-1" />
					</div>
				</div>
			)}

			<MessageInput
				onSend={onSend}
				disabled={streaming || !hasActiveConversation}
				placeholder={
					!hasActiveConversation
						? "Select or create a conversation to start chatting"
						: "Ask anything about your data..."
				}
			/>
		</div>
	);
}
