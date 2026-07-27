const MAX_ENTRIES = 1000;
const ENTRY_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Session iteration tracker with TTL eviction.
 * Stores { count, timestamp } per sessionID.
 * On each access, evicts expired entries and caps size at MAX_ENTRIES.
 */
class IterationCountMap {
	constructor() {
		/** @type {Map<string, { count: number, timestamp: number }>} */
		this._map = new Map();
	}

	/**
	 * Evict expired entries (older than TTL). If still over cap, delete oldest.
	 */
	_cleanup() {
		const now = Date.now();

		for (const [key, entry] of this._map) {
			if (now - entry.timestamp > ENTRY_TTL_MS) {
				this._map.delete(key);
			}
		}

		if (this._map.size > MAX_ENTRIES) {
			const excess = this._map.size - MAX_ENTRIES;
			let removed = 0;
			for (const key of this._map.keys()) {
				if (removed >= excess) break;
				this._map.delete(key);
				removed++;
			}
		}
	}

	/**
	 * @param {string} sessionId
	 * @returns {number}
	 */
	get(sessionId) {
		this._cleanup();
		const entry = this._map.get(sessionId);
		if (!entry) return 0;
		if (Date.now() - entry.timestamp > ENTRY_TTL_MS) {
			this._map.delete(sessionId);
			return 0;
		}
		return entry.count;
	}

	/**
	 * @param {string} sessionId
	 * @param {number} count
	 */
	set(sessionId, count) {
		this._cleanup();
		this._map.set(sessionId, { count, timestamp: Date.now() });
	}
}

/** @type {IterationCountMap} */
const iterationCount = new IterationCountMap();

const MAX_ITERATIONS = 3;

/**
 * Injects Techstream quality gate context into session compaction.
 * Tracks iteration count per session to enforce refinement limits.
 *
 * @param {{ sessionID: string }} input
 * @param {{ context: string[], prompt?: string }} output
 */
export async function refinementLoop(input, output) {
	const sessionId = input.sessionID;
	const currentIteration = iterationCount.get(sessionId) || 0;
	const nextIteration = currentIteration + 1;
	iterationCount.set(sessionId, nextIteration);

	const qualityGateContext =
		"## Techstream Quality Gate\n" +
		"Before finalizing, verify:\n" +
		"- Brand voice consistency with client guidelines\n" +
		"- SEO keyword presence and metadata optimization\n" +
		"- Accessibility compliance (WCAG 2.2)\n" +
		"- Visual coherence and layout consistency\n" +
		`- Refinement iteration: ${nextIteration}/${MAX_ITERATIONS}`;

	output.context.push(qualityGateContext);

	if (nextIteration >= MAX_ITERATIONS) {
		output.context.push(
			"## Techstream Refinement Limit\n" +
				`This session has reached the maximum of ${MAX_ITERATIONS} refinement iterations. ` +
				"The current output should be considered final unless a human explicitly requests further changes.",
		);
	}
}
