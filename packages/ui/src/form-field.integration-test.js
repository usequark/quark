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
	const wrapper = container.querySelector('[aria-invalid="true"]');
	assert.ok(wrapper, "should set aria-invalid on wrapper");
	const errorId = wrapper.getAttribute("aria-describedby");
	assert.ok(errorId, "should set aria-describedby");
	const errorEl = container.querySelector(`#${errorId}`);
	assert.ok(errorEl, "aria-describedby should point to existing error element");
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
