/**
 * Context Retrieval Utility
 *
 * Generic, project-agnostic utility for retrieving relevant business context.
 * Designed to be portable - can be copied to any Quark project with minimal changes.
 *
 * Features:
 *  - getRelevantContext(question, records) - filters context by keyword relevance
 *  - summarizeContext(records) - brief category overview
 *  - shouldProcess(input, previousHash) - dedup check for extraction
 */

// ── Default Keyword Map ──────────────────────────────────────────────────────
// Maps question keywords to BusinessContext categories.
// Generic enough for any project - customize by extending or replacing.
const DEFAULT_KEYWORD_MAP = {
	billing: [
		"billing",
		"invoice",
		"pay",
		"payment",
		"money",
		"cost",
		"revenue",
		"price",
		"$",
		"rate",
		"fee",
		"subscription",
		"plan",
		"charge",
	],
	client: [
		"client",
		"customer",
		"company",
		"business",
		"organization",
		"project",
		"account",
		"partner",
		"vendor",
	],
	task: [
		"task",
		"todo",
		"overdue",
		"blocked",
		"progress",
		"status",
		"assign",
		"priority",
		"deadline",
		"due",
		"complete",
		"pipeline",
	],
	tech_note: [
		"tech",
		"config",
		"deploy",
		"server",
		"integration",
		"api",
		"code",
		"bug",
		"fix",
		"setup",
		"migration",
		"database",
	],
	process: [
		"process",
		"policy",
		"rule",
		"workflow",
		"how",
		"procedure",
		"guideline",
		"step",
		"method",
		"standard",
	],
	preference: [
		"prefer",
		"like",
		"want",
		"style",
		"format",
		"communication",
		"contact",
		"schedule",
		"frequency",
	],
};

// ── Relevance Scoring ────────────────────────────────────────────────────────

/**
 * Scores a context record's relevance to a question.
 * @param {Object} record - { key, value, category }
 * @param {string} question - The user's question (lowercased)
 * @param {Object} keywordMap - Custom keyword map (optional)
 * @returns {number} Relevance score (0 = irrelevant, higher = more relevant)
 */
function scoreRelevance(record, question, keywordMap = DEFAULT_KEYWORD_MAP) {
	let score = 0;
	const lowerQuestion = question;

	// Score 1: Category matches question keywords
	const categoryKeywords = keywordMap[record.category];
	if (categoryKeywords) {
		for (const kw of categoryKeywords) {
			if (lowerQuestion.includes(kw)) {
				score += 2;
			}
		}
	}

	// Score 2: Key words match question
	const keyWords = record.key.toLowerCase().split(/[.\s_-]+/);
	for (const word of keyWords) {
		if (word.length > 2 && lowerQuestion.includes(word)) {
			score += 3;
		}
	}

	// Score 3: Value contains question keywords (partial match)
	const valueLower = (record.value || "").toLowerCase();
	const questionWords = lowerQuestion.split(/\s+/).filter((w) => w.length > 3);
	for (const word of questionWords) {
		if (valueLower.includes(word)) {
			score += 1;
		}
	}

	return score;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Filters context records to only those relevant to a question.
 * Returns records with score > 0, sorted by relevance (highest first).
 * If no records score > 0, returns a summary instead.
 *
 * @param {string} question - The user's question
 * @param {Array<Object>} records - BusinessContext records [{ key, value, category, source }]
 * @param {Object} [options]
 * @param {number} [options.maxRecords=15] - Max records to return
 * @param {number} [options.minScore=1] - Minimum relevance score
 * @param {Object} [options.keywordMap] - Custom keyword map
 * @returns {Object} { records: Array, summary: string|null }
 */
export function getRelevantContext(question, records, options = {}) {
	const {
		maxRecords = 15,
		minScore = 1,
		keywordMap = DEFAULT_KEYWORD_MAP,
	} = options;

	if (!question || !records || records.length === 0) {
		return { records: [], summary: "No business context available." };
	}

	const lowerQuestion = question.toLowerCase();

	// Score all records
	const scored = records.map((r) => ({
		...r,
		_score: scoreRelevance(r, lowerQuestion, keywordMap),
	}));

	// Filter by minimum score
	const relevant = scored
		.filter((r) => r._score >= minScore)
		.sort((a, b) => b._score - a._score)
		.slice(0, maxRecords);

	// Clean up internal score field
	const cleanRecords = relevant.map(({ _score, ...r }) => r);

	if (cleanRecords.length > 0) {
		return { records: cleanRecords, summary: null };
	}

	// No relevant records found - return a summary instead
	return {
		records: [],
		summary: summarizeContext(records),
	};
}

/**
 * Creates a brief category summary of all context records.
 * Tells the AI what's available without overwhelming it with details.
 *
 * @param {Array<Object>} records
 * @returns {string}
 */
export function summarizeContext(records) {
	if (!records || records.length === 0) {
		return "No business context available.";
	}

	const byCategory = {};
	for (const r of records) {
		if (!byCategory[r.category]) byCategory[r.category] = [];
		byCategory[r.category].push(r);
	}

	const totalManual = records.filter((r) => r.source === "manual").length;
	const totalSeed = records.filter((r) => r.source === "seed").length;

	let summary = `Available business context (${records.length} records, ${totalSeed} curated + ${totalManual} manual):\n`;

	for (const [category, entries] of Object.entries(byCategory)) {
		const label = category.charAt(0).toUpperCase() + category.slice(1);
		const manual = entries.filter((e) => e.source === "manual").length;
		const seed = entries.filter((e) => e.source === "seed").length;
		summary += `- **${label}**: ${entries.length} records`;
		if (seed > 0) summary += ` (${seed} curated, ${manual} manual)`;
		summary += "\n";
	}

	summary +=
		"\nUse `getRelevantContext` with a specific question to retrieve detailed context.";

	return summary;
}

/**
 * Creates a deterministic hash of input data for dedup checking.
 * Returns null if input is empty.
 *
 * @param {string} input - The data to hash (e.g., conversation text, task data)
 * @returns {string|null} Hex hash string, or null if empty
 */
export function hashInput(input) {
	if (!input || typeof input !== "string" || input.trim().length === 0) {
		return null;
	}

	// Simple hash function (no crypto dependency needed)
	let hash = 0;
	const str = input.trim();
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0; // Convert to 32bit integer
	}
	return Math.abs(hash).toString(16);
}

/**
 * Checks whether an input should be processed, based on a previous hash.
 * Useful for skipping extraction when nothing has changed.
 *
 * @param {string} input - The current input data
 * @param {string|null} previousHash - The hash from the last successful processing
 * @returns {Object} { shouldProcess: boolean, hash: string|null }
 */
export function shouldProcess(input, previousHash) {
	const currentHash = hashInput(input);

	if (!currentHash) {
		return { shouldProcess: false, hash: null };
	}

	if (currentHash === previousHash) {
		return { shouldProcess: false, hash: currentHash };
	}

	return { shouldProcess: true, hash: currentHash };
}
