import assert from "node:assert";
import { test } from "node:test";
import { Checkbox } from "./checkbox.js";

test("Checkbox - exports correctly", () => {
	assert(typeof Checkbox === "function");
});

test("Checkbox - renders with default props", () => {
	const result = Checkbox({ id: "check1", label: "Accept terms" });
	assert.ok(result);
});

test("Checkbox - accepts className override", () => {
	const result = Checkbox({
		id: "check2",
		label: "Option",
		className: "custom",
	});
	assert.ok(result);
});

test("Checkbox - accepts checked prop", () => {
	const result = Checkbox({
		id: "check3",
		label: "Checked",
		defaultChecked: true,
	});
	assert.ok(result);
});

test("Checkbox - accepts disabled prop", () => {
	const result = Checkbox({ id: "check4", label: "Disabled", disabled: true });
	assert.ok(result);
});
