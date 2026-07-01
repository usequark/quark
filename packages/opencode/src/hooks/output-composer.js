/**
 * Composes multi-part message outputs into structured deliverables.
 * Mutates output.messages in place (hook API contract).
 *
 * @param {Object} _input
 * @param {{ messages: Array<{info: any, parts: Array<{type: string, text?: string}>}> }} output
 */
export async function outputComposer(_input, output) {
	for (const msg of output.messages) {
		const parts = msg.parts;
		if (!parts || parts.length <= 1) continue;

		const textParts = parts.filter((p) => p.type === "text");
		if (textParts.length <= 1) continue;

		const combined = textParts.map((p) => p.text || "").join("\n\n");
		const structured = JSON.stringify({
			draft: combined,
			metadata: {
				wordCount: combined.split(/\s+/).length,
				partCount: parts.length,
			},
		});

		// Replace multiple text parts with a single composed text part
		msg.parts = [{ type: "text", text: structured }];
	}
}
