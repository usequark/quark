import assert from "node:assert";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM(
	"<!DOCTYPE html><html><body><div id='root'></div></body></html>",
	{
		url: "http://localhost",
		pretendToBeVisual: true,
	},
);

function setGlobal(key, value) {
	Object.defineProperty(globalThis, key, {
		value,
		writable: true,
		configurable: true,
	});
}

setGlobal("document", dom.window.document);
setGlobal("window", dom.window);
setGlobal("navigator", dom.window.navigator);
setGlobal("HTMLElement", dom.window.HTMLElement);
setGlobal("Node", dom.window.Node);
setGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { FormField } = await import("./form-field.js");

after(() => {
	delete globalThis.document;
	delete globalThis.window;
	delete globalThis.navigator;
	delete globalThis.HTMLElement;
	delete globalThis.Node;
	delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

function setupContainer() {
	const container = dom.window.document.createElement("div");
	dom.window.document.body.appendChild(container);
	return container;
}

test("FormField - renders label and input", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(createElement(FormField, { label: "Name", name: "name" })),
	);
	const label = container.querySelector("label");
	const input = container.querySelector("input");
	assert.ok(label, "should render a label");
	assert.ok(input, "should render an input");
	assert.strictEqual(label.textContent, "Name");
	assert.strictEqual(input.getAttribute("name"), "name");
	root.unmount();
});

test("FormField - connects label to input via htmlFor/id", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(
			createElement(FormField, {
				label: "Email",
				name: "email",
				id: "custom-id",
			}),
		),
	);
	const label = container.querySelector("label");
	const input = container.querySelector("input");
	assert.strictEqual(label.getAttribute("for"), "custom-id");
	assert.strictEqual(input.getAttribute("id"), "custom-id");
	root.unmount();
});

test("FormField - renders error message with role alert", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(
			createElement(FormField, {
				label: "Email",
				name: "email",
				error: "Required",
			}),
		),
	);
	const errorEl = container.querySelector("[role='alert']");
	assert.ok(errorEl, "should render an error element with role alert");
	assert.strictEqual(errorEl.textContent, "Required");
	root.unmount();
});

test("FormField - sets aria-invalid and aria-describedby when error present", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(
			createElement(FormField, {
				label: "Email",
				name: "email",
				error: "Required",
				id: "email-field",
			}),
		),
	);
	const input = container.querySelector("input");
	assert.ok(input, "should render an input");
	assert.strictEqual(
		input.getAttribute("aria-invalid"),
		"true",
		"aria-invalid must be on the focusable control",
	);
	assert.ok(
		!container.querySelector("div[aria-invalid]"),
		"aria-invalid on a non-interactive wrapper has no effect",
	);
	const errorId = input.getAttribute("aria-describedby");
	assert.ok(errorId, "should set aria-describedby on the input");
	assert.strictEqual(errorId, "email-field-error");
	const errorEl = container.querySelector(`#${errorId}`);
	assert.ok(errorEl, "aria-describedby should point to existing error element");
	root.unmount();
});

test("FormField - applies className to the control, not the wrapper", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(
			createElement(FormField, {
				label: "Name",
				name: "name",
				className: "w-72",
			}),
		),
	);
	const input = container.querySelector("input");
	assert.match(input.getAttribute("class"), /\bw-72\b/);
	assert.doesNotMatch(
		container.firstElementChild.getAttribute("class"),
		/\bw-72\b/,
		"className targets the control; the wrapper is layout-only",
	);
	root.unmount();
});

test("FormField - wrapperClassName styles the layout container", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(
			createElement(FormField, {
				label: "Name",
				name: "name",
				wrapperClassName: "sm:col-span-2",
			}),
		),
	);
	assert.match(
		container.firstElementChild.getAttribute("class"),
		/\bsm:col-span-2\b/,
	);
	root.unmount();
});

test("FormField - forwards error ARIA to a custom child control", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(
			createElement(
				FormField,
				{ label: "Bio", name: "bio", error: "Too short", id: "bio" },
				createElement("textarea", { id: "bio", "data-testid": "custom" }),
			),
		),
	);
	const textarea = container.querySelector("textarea");
	assert.strictEqual(textarea.getAttribute("aria-invalid"), "true");
	assert.strictEqual(textarea.getAttribute("aria-describedby"), "bio-error");
	assert.ok(
		container.querySelector("#bio-error"),
		"describedby target must exist",
	);
	assert.strictEqual(
		textarea.getAttribute("name"),
		"bio",
		"name should be forwarded to the custom control",
	);
	root.unmount();
});

test("FormField - preserves a custom child's own className", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(
			createElement(
				FormField,
				{ label: "Bio", name: "bio", className: "h-40" },
				createElement("textarea", { className: "resize-y" }),
			),
		),
	);
	const cls = container.querySelector("textarea").getAttribute("class");
	assert.match(cls, /\bresize-y\b/);
	assert.match(cls, /\bh-40\b/);
	root.unmount();
});

test("FormField - leaves aria-invalid off when there is no error", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(createElement(FormField, { label: "Name", name: "name" })),
	);
	const input = container.querySelector("input");
	assert.strictEqual(input.getAttribute("aria-invalid"), null);
	assert.strictEqual(input.getAttribute("aria-describedby"), null);
	root.unmount();
});

test("FormField - renders children instead of default input", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(
			createElement(
				FormField,
				{ label: "Bio", name: "bio" },
				createElement("textarea", { "data-testid": "custom" }),
			),
		),
	);
	const textarea = container.querySelector("textarea");
	assert.ok(textarea, "should render custom children instead of input");
	assert.strictEqual(
		container.querySelector("input"),
		null,
		"should not render default input",
	);
	root.unmount();
});
