"use client";

import { useEffect, useRef, useState } from "react";
import AsciiPanel from "./AsciiPanel.js";

const INNER_W = 34;
const TYPING_MS = 2000;
const HOLD_MS = 5000;
const UNTYPING_MS = 1500;
const NUM_PANELS = 3;

const PHASE_INITIAL_TYPING = 0;
const PHASE_HOLD = 1;
const PHASE_UNTYPE_0 = 2;
const PHASE_TYPE_0 = 3;
const PHASE_HOLD_AFTER_0 = 4;
const PHASE_UNTYPE_1 = 5;
const PHASE_TYPE_1 = 6;
const PHASE_HOLD_AFTER_1 = 7;
const PHASE_UNTYPE_2 = 8;
const PHASE_TYPE_2 = 9;
const PHASE_HOLD_AFTER_2 = 10;

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

function getContentLines(panel) {
	const t = wrapText(panel.title, INNER_W);
	const d = wrapText(panel.description, INNER_W);
	return [...t, "", ...d];
}

function getMaxDisplayLines(panels) {
	return Math.max(...panels.map((panel) => getContentLines(panel).length));
}

function getTotalChars(panel) {
	const t = wrapText(panel.title, INNER_W);
	const d = wrapText(panel.description, INNER_W);
	return t.join("").length + d.join("").length;
}

const PHASE_DURATION = {
	[PHASE_INITIAL_TYPING]: TYPING_MS,
	[PHASE_HOLD]: HOLD_MS,
	[PHASE_UNTYPE_0]: UNTYPING_MS,
	[PHASE_TYPE_0]: TYPING_MS,
	[PHASE_HOLD_AFTER_0]: HOLD_MS,
	[PHASE_UNTYPE_1]: UNTYPING_MS,
	[PHASE_TYPE_1]: TYPING_MS,
	[PHASE_HOLD_AFTER_1]: HOLD_MS,
	[PHASE_UNTYPE_2]: UNTYPING_MS,
	[PHASE_TYPE_2]: TYPING_MS,
	[PHASE_HOLD_AFTER_2]: HOLD_MS,
};

const NEXT_PHASE = {
	[PHASE_INITIAL_TYPING]: PHASE_HOLD,
	[PHASE_HOLD]: PHASE_UNTYPE_0,
	[PHASE_UNTYPE_0]: PHASE_TYPE_0,
	[PHASE_TYPE_0]: PHASE_HOLD_AFTER_0,
	[PHASE_HOLD_AFTER_0]: PHASE_UNTYPE_1,
	[PHASE_UNTYPE_1]: PHASE_TYPE_1,
	[PHASE_TYPE_1]: PHASE_HOLD_AFTER_1,
	[PHASE_HOLD_AFTER_1]: PHASE_UNTYPE_2,
	[PHASE_UNTYPE_2]: PHASE_TYPE_2,
	[PHASE_TYPE_2]: PHASE_HOLD_AFTER_2,
	[PHASE_HOLD_AFTER_2]: PHASE_UNTYPE_0,
};

export default function SyncedPanels({ panels }) {
	const [renderTick, setRenderTick] = useState(0);
	const [copiedIdx, setCopiedIdx] = useState(-1);
	const rafRef = useRef(null);

	const stateRef = useRef({
		phase: PHASE_INITIAL_TYPING,
		phaseStart: 0,
		started: false,
		promptIdxs: [0, 1, 2],
		charCounts: [0, 0, 0],
		queue: Array.from({ length: panels.length }, (_, i) => i).slice(NUM_PANELS),
	});

	const maxLines = getMaxDisplayLines(panels.slice(0, NUM_PANELS));
	const maxCharsRef = useRef(panels.map(getTotalChars));

	useEffect(() => {
		maxCharsRef.current = panels.map(getTotalChars);
	}, [panels]);

	useEffect(() => {
		let active = true;

		function tick(ts) {
			if (!active) return;

			const st = stateRef.current;
			if (!st.started) {
				st.started = true;
				st.phaseStart = ts;
			}

			const elapsed = ts - st.phaseStart;
			const duration = PHASE_DURATION[st.phase];
			const t = Math.min(elapsed / duration, 1);
			const p = panels;

			const isTyping =
				st.phase === PHASE_INITIAL_TYPING ||
				st.phase === PHASE_TYPE_0 ||
				st.phase === PHASE_TYPE_1 ||
				st.phase === PHASE_TYPE_2;
			const isUntyping =
				st.phase === PHASE_UNTYPE_0 ||
				st.phase === PHASE_UNTYPE_1 ||
				st.phase === PHASE_UNTYPE_2;

			const changingPanel =
				st.phase === PHASE_UNTYPE_0 || st.phase === PHASE_TYPE_0
					? 0
					: st.phase === PHASE_UNTYPE_1 || st.phase === PHASE_TYPE_1
						? 1
						: st.phase === PHASE_UNTYPE_2 || st.phase === PHASE_TYPE_2
							? 2
							: -1;

			for (let i = 0; i < NUM_PANELS; i++) {
				if (isTyping && changingPanel === i) {
					const maxChars =
						maxCharsRef.current[st.promptIdxs[i] % p.length] || 1;
					st.charCounts[i] = Math.floor(t * maxChars);
				} else if (isUntyping && changingPanel === i) {
					const maxChars =
						maxCharsRef.current[st.promptIdxs[i] % p.length] || 1;
					st.charCounts[i] = Math.floor((1 - t) * maxChars);
				} else if (isTyping && changingPanel === -1) {
					const maxChars =
						maxCharsRef.current[st.promptIdxs[i] % p.length] || 1;
					st.charCounts[i] = Math.floor(t * maxChars);
				}
			}

			if (t >= 1) {
				if (isUntyping && changingPanel >= 0) {
					if (st.queue.length === 0) {
						st.queue = Array.from({ length: p.length }, (_, i) => i).filter(
							(idx) => !st.promptIdxs.includes(idx),
						);
					}
					st.promptIdxs[changingPanel] = st.queue.shift();
					st.charCounts[changingPanel] = 0;
				}
				st.phase = NEXT_PHASE[st.phase];
				st.phaseStart = ts;
			}

			setRenderTick((n) => n + 1);
			rafRef.current = requestAnimationFrame(tick);
		}

		rafRef.current = requestAnimationFrame(tick);
		return () => {
			active = false;
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [panels]);

	void renderTick;

	function handleCopy(text, idx) {
		navigator.clipboard.writeText(text);
		setCopiedIdx(idx);
		setTimeout(() => setCopiedIdx(-1), 1500);
	}

	const st = stateRef.current;
	const p = panels;

	return (
		<div className="quark-home-panels">
			{[0, 1, 2].map((i) => {
				const panel = p[st.promptIdxs[i] % p.length];
				return (
					<AsciiPanel
						key={`panel-${i}`}
						title={panel.title}
						description={panel.description}
						prompt={panel.prompt}
						charCount={st.charCounts[i]}
						copied={copiedIdx === i}
						onCopy={() => handleCopy(panel.prompt, i)}
						maxLines={maxLines}
					/>
				);
			})}
		</div>
	);
}
