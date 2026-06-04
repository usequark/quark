import assert from "node:assert";
import { test } from "node:test";
import { Lightbox } from "./lightbox.js";

// Lightbox is a client component that uses React hooks (useRef, useEffect,
// useState) and requires a React renderer to execute. Full render tests belong
// in an integration test suite with jsdom + react-dom. Here we verify the
// export contract only.

test("Lightbox - exports correctly", () => {
	assert(typeof Lightbox === "function");
});

test("Lightbox - has expected function name", () => {
	assert.strictEqual(Lightbox.name, "Lightbox");
});
