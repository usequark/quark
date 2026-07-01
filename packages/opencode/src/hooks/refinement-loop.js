/** @type {Map<string, number>} */
const iterationCount = new Map();

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
