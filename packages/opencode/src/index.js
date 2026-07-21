import { outputComposer } from "./hooks/output-composer.js";
import { refinementLoop } from "./hooks/refinement-loop.js";
import { checkCompliance } from "./tools/check-compliance.js";
import { publishToCms } from "./tools/publish-to-cms.js";

/** @type {import("@opencode-ai/plugin").Plugin} */
export default async function techstreamPlugin(_input, _options) {
	return {
		"experimental.session.compacting": (hookInput, hookOutput) =>
			refinementLoop(hookInput, hookOutput),
		"experimental.chat.messages.transform": (hookInput, hookOutput) =>
			outputComposer(hookInput, hookOutput),
		tool: {
			"publish-to-cms": publishToCms,
			"check-compliance": checkCompliance,
		},
	};
}
