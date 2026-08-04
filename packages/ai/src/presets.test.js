import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getDefaultAccessLevel, KNOWN_TOOL_NAMES } from "./presets.js";

describe("getDefaultAccessLevel", () => {
	test("admin gets auto for all tools", () => {
		assert.equal(getDefaultAccessLevel("admin", "create_contact"), "auto");
		assert.equal(getDefaultAccessLevel("admin", "search_contacts"), "auto");
	});

	test("editor gets confirm for write tools and auto for read tools", () => {
		assert.equal(getDefaultAccessLevel("editor", "create_contact"), "confirm");
		assert.equal(getDefaultAccessLevel("editor", "update_deal"), "confirm");
		assert.equal(getDefaultAccessLevel("editor", "search_contacts"), "auto");
		assert.equal(getDefaultAccessLevel("editor", "web_search"), "auto");
	});

	test("viewer gets disabled for all tools", () => {
		assert.equal(getDefaultAccessLevel("viewer", "create_contact"), "disabled");
		assert.equal(
			getDefaultAccessLevel("viewer", "search_contacts"),
			"disabled",
		);
	});

	test("unknown role defaults to auto", () => {
		assert.equal(getDefaultAccessLevel("unknown", "create_contact"), "auto");
	});

	test("KNOWN_TOOL_NAMES includes core CRM tools", () => {
		assert.ok(KNOWN_TOOL_NAMES.includes("create_contact"));
		assert.ok(KNOWN_TOOL_NAMES.includes("web_search"));
	});
});
