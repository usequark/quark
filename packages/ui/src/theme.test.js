import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";

/**
 * `ThemeProvider` / `useTheme` / `ThemeToggle` need a real React renderer, so
 * these run under jsdom rather than asserting the export contract only (the
 * reason #6 survived: nothing in this package ever rendered the theme system).
 *
 * Harness notes, both measured rather than assumed:
 * - jsdom does not implement `matchMedia` at all (`TypeError: ... is not a
 *   function`), which `ThemeProvider` calls in a layout effect.
 * - Node has no `localStorage` global, and `theme.js` reads the bare identifier,
 *   so it must be exposed or every provider render dies on that ReferenceError.
 *
 * Each test file runs in its own process under `node --test`, so leaking these
 * globals does not affect sibling suites.
 */

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
	url: "http://localhost",
	pretendToBeVisual: true,
});

function setGlobal(key, value) {
	Object.defineProperty(globalThis, key, {
		value,
		writable: true,
		configurable: true,
	});
}

function stubMatchMedia(query, matches) {
	return {
		matches,
		media: query,
		onchange: null,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {},
		dispatchEvent: () => false,
	};
}

// The OS prefers dark, so an unseeded machine resolves to "dark".
const osPrefersDark = () =>
	stubMatchMedia("(prefers-color-scheme: dark)", true);

setGlobal("document", dom.window.document);
setGlobal("window", dom.window);
setGlobal("navigator", dom.window.navigator);
setGlobal("HTMLElement", dom.window.HTMLElement);
setGlobal("Node", dom.window.Node);
setGlobal("localStorage", dom.window.localStorage);
setGlobal("matchMedia", osPrefersDark);
setGlobal("IS_REACT_ACT_ENVIRONMENT", true);
dom.window.matchMedia = osPrefersDark;

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { renderToString } = await import("react-dom/server");
const { act } = await import("react");
const { ThemeProvider, ThemeToggle, useTheme } = await import("./theme.js");
const { THEME_ATTR, THEME_STORAGE_KEY } = await import("./theme-constants.js");

const html = () => dom.window.document.documentElement;

beforeEach(() => {
	dom.window.localStorage.clear();
	dom.window.document.body.replaceChildren();
	html().removeAttribute(THEME_ATTR);
});

after(() => {
	for (const key of [
		"document",
		"window",
		"navigator",
		"HTMLElement",
		"Node",
		"localStorage",
		"matchMedia",
		"IS_REACT_ACT_ENVIRONMENT",
	]) {
		delete globalThis[key];
	}
});

async function render(element) {
	const container = dom.window.document.createElement("div");
	dom.window.document.body.appendChild(container);
	const root = createRoot(container);
	await act(() => root.render(element));
	return {
		container,
		async unmount() {
			await act(() => root.unmount());
			container.remove();
		},
	};
}

async function click(element) {
	await act(async () => {
		element.dispatchEvent(
			new dom.window.MouseEvent("click", { bubbles: true }),
		);
	});
}

test("theme - exports the documented public API", () => {
	assert.equal(typeof ThemeProvider, "function");
	assert.equal(typeof useTheme, "function");
	assert.equal(typeof ThemeToggle, "function");
});

test("ThemeToggle - a click inside a provider really flips data-theme", async () => {
	const view = await render(
		createElement(ThemeProvider, null, createElement(ThemeToggle)),
	);
	const button = view.container.querySelector("button");

	assert.equal(html().getAttribute(THEME_ATTR), "dark");
	assert.match(button.textContent, /Dark Mode/);

	await click(button);

	// The whole point of #6: not merely "no error", but the attribute moved.
	assert.equal(html().getAttribute(THEME_ATTR), "light");
	assert.match(button.textContent, /Light Mode/);
	assert.equal(button.getAttribute("aria-pressed"), "false");

	await click(button);
	assert.equal(html().getAttribute(THEME_ATTR), "dark");

	await view.unmount();
});

test("ThemeToggle - a click persists the choice to localStorage", async () => {
	const view = await render(
		createElement(ThemeProvider, null, createElement(ThemeToggle)),
	);
	await click(view.container.querySelector("button"));

	assert.equal(
		dom.window.localStorage.getItem(THEME_STORAGE_KEY),
		"light",
		"an explicit toggle must survive a reload",
	);

	await view.unmount();
});

test("ThemeProvider - restores the stored preference on mount", async () => {
	dom.window.localStorage.setItem(THEME_STORAGE_KEY, "light");
	const view = await render(
		createElement(ThemeProvider, null, createElement(ThemeToggle)),
	);

	assert.equal(html().getAttribute(THEME_ATTR), "light");
	assert.match(
		view.container.querySelector("button").textContent,
		/Light Mode/,
	);

	await view.unmount();
});

test("ThemeProvider - honours defaultTheme when nothing is stored", async () => {
	const view = await render(
		createElement(
			ThemeProvider,
			{ defaultTheme: "light" },
			createElement(ThemeToggle),
		),
	);

	assert.equal(html().getAttribute(THEME_ATTR), "light");

	await view.unmount();
});

test("ThemeProvider - stays in sync with an external THEME_CHANGE_EVENT", async () => {
	// apps/web's HomeThemeToggle drives localStorage and this event directly
	// instead of consuming the context. Mounting ThemeProvider must not break
	// that bridge, and must not echo back into an event storm.
	const view = await render(
		createElement(ThemeProvider, null, createElement(ThemeToggle)),
	);
	assert.equal(html().getAttribute(THEME_ATTR), "dark");

	await act(async () => {
		dom.window.localStorage.setItem(THEME_STORAGE_KEY, "light");
		html().setAttribute(THEME_ATTR, "light");
		dom.window.document.dispatchEvent(
			new dom.window.CustomEvent("quark-theme-change", {
				detail: { theme: "light" },
			}),
		);
	});

	assert.match(
		view.container.querySelector("button").textContent,
		/Light Mode/,
	);

	await view.unmount();
});

test("useTheme - throws instead of silently no-oping without a provider", () => {
	// Regression guard for #6. The context default used to be
	// `{ theme: "dark", setTheme: noop }`, so a ThemeToggle rendered outside a
	// provider produced a working-looking button that never changed anything and
	// always reported "Dark Mode". Verify that exact scenario now fails loudly.
	// Rendered on the server because client roots re-surface the error
	// asynchronously instead of throwing at the call site.
	assert.throws(
		() =>
			renderToString(
				createElement(function Probe() {
					useTheme();
					return null;
				}),
			),
		/ThemeProvider/,
		"useTheme() outside a provider must throw",
	);
});

test("ThemeToggle - cannot render outside a provider", () => {
	// The user-visible half of the same defect: a toggle that renders but
	// does nothing on click.
	assert.throws(
		() => renderToString(createElement(ThemeToggle)),
		/ThemeProvider/,
		"ThemeToggle outside a provider must throw, not render a dead button",
	);
});

test("ThemeProvider - does not emit a DOM wrapper of its own", async () => {
	const view = await render(
		createElement(ThemeProvider, null, createElement(ThemeToggle)),
	);
	assert.equal(
		view.container.childElementCount,
		1,
		"provider must stay markup-free so it can wrap <body> content safely",
	);

	await view.unmount();
});
