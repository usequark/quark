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
setGlobal("requestAnimationFrame", dom.window.requestAnimationFrame);
setGlobal("cancelAnimationFrame", dom.window.cancelAnimationFrame);
setGlobal("KeyboardEvent", dom.window.KeyboardEvent);
setGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { Lightbox } = await import("./lightbox.js");

after(() => {
	delete globalThis.document;
	delete globalThis.window;
	delete globalThis.navigator;
	delete globalThis.HTMLElement;
	delete globalThis.Node;
	delete globalThis.requestAnimationFrame;
	delete globalThis.cancelAnimationFrame;
	delete globalThis.KeyboardEvent;
	delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

function setupContainer() {
	const container = dom.window.document.createElement("div");
	dom.window.document.body.appendChild(container);
	return container;
}

test("Lightbox - renders nothing when closed", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() => root.render(createElement(Lightbox, { open: false })));
	assert.strictEqual(container.innerHTML, "");
	await act(() => root.unmount());
	container.remove();
});

test("Lightbox - renders overlay when open", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(
			createElement(Lightbox, {
				open: true,
				src: "/test.jpg",
				alt: "Test image",
				onClose: () => {},
			}),
		),
	);
	const img = container.querySelector("img");
	assert.ok(img, "should render an img element");
	assert.strictEqual(img.getAttribute("src"), "/test.jpg");
	assert.strictEqual(img.getAttribute("alt"), "Test image");
	await act(() => root.unmount());
	container.remove();
});

test("Lightbox - calls onClose when close button clicked", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	let closed = false;
	await act(() =>
		root.render(
			createElement(Lightbox, {
				open: true,
				src: "/test.jpg",
				onClose: () => {
					closed = true;
				},
			}),
		),
	);
	const closeBtn = container.querySelector(
		"button[aria-label='Close lightbox']",
	);
	assert.ok(closeBtn, "should have a close button");
	await act(() => closeBtn.click());
	assert.ok(closed, "onClose should be called");
	await act(() => root.unmount());
	container.remove();
});

test("Lightbox - shows prev/next buttons and counter", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	await act(() =>
		root.render(
			createElement(Lightbox, {
				open: true,
				src: "/img2.jpg",
				showPrevious: true,
				showNext: true,
				currentIndex: 2,
				totalCount: 5,
				onPrevious: () => {},
				onNext: () => {},
				onClose: () => {},
			}),
		),
	);
	assert.ok(
		container.textContent.includes("Previous"),
		"should show Previous button",
	);
	assert.ok(container.textContent.includes("Next"), "should show Next button");
	assert.ok(container.textContent.includes("2 / 5"), "should show counter");
	await act(() => root.unmount());
	container.remove();
});

test("Lightbox - calls onPrevious and onNext on button clicks", async () => {
	const container = setupContainer();
	const root = createRoot(container);
	let prev = false;
	let next = false;
	await act(() =>
		root.render(
			createElement(Lightbox, {
				open: true,
				src: "/img2.jpg",
				showPrevious: true,
				showNext: true,
				onPrevious: () => {
					prev = true;
				},
				onNext: () => {
					next = true;
				},
				onClose: () => {},
			}),
		),
	);
	const buttons = container.querySelectorAll("button");
	const prevBtn = Array.from(buttons).find((b) =>
		b.textContent.includes("Previous"),
	);
	const nextBtn = Array.from(buttons).find((b) =>
		b.textContent.includes("Next"),
	);
	await act(() => prevBtn.click());
	assert.ok(prev, "onPrevious should be called");
	await act(() => nextBtn.click());
	assert.ok(next, "onNext should be called");
	await act(() => root.unmount());
	container.remove();
});
