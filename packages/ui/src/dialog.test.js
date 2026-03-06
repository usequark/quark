import assert from "node:assert";
import { test } from "node:test";
import { Dialog } from "./dialog.js";

// Dialog uses React hooks (useRef, useEffect) and requires a React renderer to
// render correctly. Full render tests belong in an integration test suite with
// jsdom + react-dom. Here we verify the export contract only.

test("Dialog - exports correctly", () => {
	assert(typeof Dialog === "function");
});

test("Dialog - has expected function name", () => {
	assert.strictEqual(Dialog.name, "Dialog");
});
