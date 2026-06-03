import assert from "node:assert";
import { test } from "node:test";
import { PhotoGallery } from "./photo-gallery.js";

test("PhotoGallery - exports correctly", () => {
	assert(typeof PhotoGallery === "function");
});

test("PhotoGallery - has expected function name", () => {
	assert.strictEqual(PhotoGallery.name, "PhotoGallery");
});
