"use client";

const INNER_W = 34;

function wrapText(text, maxLen) {
	const words = text.split(" ");
	const lines = [];
	let current = "";
	for (const word of words) {
		if (current.length + (current ? 1 : 0) + word.length > maxLen) {
			if (current) lines.push(current);
			current = word.length > maxLen ? word.slice(0, maxLen) : word;
		} else {
			current = current ? `${current} ${word}` : word;
		}
	}
	if (current) lines.push(current);
	return lines.length ? lines : [""];
}

function border(top) {
	const inner = "\u2500".repeat(INNER_W + 2);
	return top ? `\u250C${inner}\u2510` : `\u2514${inner}\u2518`;
}

function emptyLine() {
	return `\u2502${" ".repeat(INNER_W + 2)}\u2502`;
}

export default function AsciiPanel({
	title,
	description,
	prompt,
	charCount,
	onCopy,
	copied,
	maxLines,
}) {
	const titleChars = wrapText(title, INNER_W);
	const descChars = wrapText(description, INNER_W);

	const contentLines = [...titleChars, "", ...descChars];
	const totalDisplayLines = Math.max(maxLines, contentLines.length);

	function getChar(lineIdx, charIdx) {
		let offset = 0;
		for (let i = 0; i < lineIdx; i++) {
			offset += contentLines[i].length;
		}
		const pos = offset + charIdx;
		if (pos < charCount) {
			return contentLines[lineIdx]?.[charIdx] ?? " ";
		}
		return " ";
	}

	const rows = [];
	for (let li = 0; li < totalDisplayLines; li++) {
		const line = contentLines[li] ?? "";
		const isBlank = li >= contentLines.length || line === "";
		if (isBlank) {
			rows.push(
				<span key={li} className="quark-ascii-line">
					{`${emptyLine()}\n`}
				</span>,
			);
		} else {
			const chars = [];
			for (let ci = 0; ci < INNER_W; ci++) {
				chars.push(
					<span key={ci} className="quark-ascii-char">
						{getChar(li, ci)}
					</span>,
				);
			}
			rows.push(
				<span key={li} className="quark-ascii-line">
					{`\u2502 `}
					{chars}
					{` \u2502\n`}
				</span>,
			);
		}
	}

	return (
		<article className="quark-ascii-panel" title={prompt}>
			<pre className="quark-ascii-box">
				{`${border(true)}\n`}
				{rows}
				{`${border(false)}`}
			</pre>
			<button
				type="button"
				className={`quark-ascii-copy${copied ? " quark-ascii-copy--copied" : ""}`}
				onClick={onCopy}
				aria-label={copied ? "Copied" : "Copy prompt"}
			>
				{copied ? "copied" : "copy"}
			</button>
		</article>
	);
}
