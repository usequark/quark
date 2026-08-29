"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MarkdownRenderer({ content }) {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			components={{
				code({ className, children, ...props }) {
					const match = /language-(\w+)/.exec(className || "");
					const isInline = !match;
					if (!isInline) {
						return (
							<div className="relative group my-3">
								<div className="absolute top-2 right-2 text-[10px] text-text-faint font-mono opacity-0 group-hover:opacity-100 transition-opacity">
									{match[1]}
								</div>
								<pre className="bg-surface-hover p-4 rounded-lg overflow-x-auto text-sm border border-border">
									<code className={className} {...props}>
										{children}
									</code>
								</pre>
							</div>
						);
					}
					return (
						<code
							className="bg-surface-hover text-sm px-1.5 py-0.5 rounded font-mono"
							{...props}
						>
							{children}
						</code>
					);
				},
				table({ children }) {
					return (
						<div className="overflow-x-auto my-4 border border-border rounded-lg">
							<table className="w-full text-sm divide-y divide-border">
								{children}
							</table>
						</div>
					);
				},
				th({ children }) {
					return (
						<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-faint bg-surface-hover">
							{children}
						</th>
					);
				},
				td({ children }) {
					return <td className="px-3 py-2 text-text">{children}</td>;
				},
				a({ href, children }) {
					return (
						<a
							href={href}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary underline underline-offset-2 hover:text-primary/80"
						>
							{children}
						</a>
					);
				},
				ul({ children }) {
					return (
						<ul className="list-disc list-inside space-y-1 my-2 text-text">
							{children}
						</ul>
					);
				},
				ol({ children }) {
					return (
						<ol className="list-decimal list-inside space-y-1 my-2 text-text">
							{children}
						</ol>
					);
				},
				blockquote({ children }) {
					return (
						<blockquote className="border-l-2 border-primary/30 pl-4 my-3 text-text-muted italic">
							{children}
						</blockquote>
					);
				},
				h1({ children }) {
					return (
						<h1 className="text-xl font-bold text-text mt-4 mb-2">
							{children}
						</h1>
					);
				},
				h2({ children }) {
					return (
						<h2 className="text-lg font-semibold text-text mt-3 mb-2">
							{children}
						</h2>
					);
				},
				h3({ children }) {
					return (
						<h3 className="text-base font-semibold text-text mt-3 mb-1">
							{children}
						</h3>
					);
				},
				p({ children }) {
					return <p className="my-2 text-text leading-relaxed">{children}</p>;
				},
			}}
		>
			{content}
		</ReactMarkdown>
	);
}

export default function MessageBubble({
	message,
	isStreaming,
	streamingContent,
}) {
	const contentRef = useRef(null);

	useEffect(() => {
		if (contentRef.current) {
			contentRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [message, isStreaming]);

	const isUser = message.role === "user";
	const isSystem = message.role === "system";

	if (isSystem) {
		return (
			<div className="flex justify-center py-2">
				<span className="text-xs text-text-faint bg-surface px-3 py-1 rounded-full">
					{message.content}
				</span>
			</div>
		);
	}

	if (isUser) {
		return (
			<div className="flex justify-end py-2">
				<div className="max-w-[80%] bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed">
					{message.content}
				</div>
			</div>
		);
	}

	// Assistant message
	const displayContent =
		isStreaming && streamingContent ? streamingContent : message.content;

	return (
		<div className="flex justify-start py-2" ref={contentRef}>
			<div className="max-w-[85%] bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-3 text-sm">
				{displayContent ? (
					<MarkdownRenderer content={displayContent} />
				) : isStreaming ? (
					<div className="flex gap-1 py-1">
						<span className="inline-block w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse [animation-delay:0ms]" />
						<span className="inline-block w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse [animation-delay:150ms]" />
						<span className="inline-block w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse [animation-delay:300ms]" />
					</div>
				) : null}
			</div>
		</div>
	);
}
