import assert from "node:assert";
import { test } from "node:test";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./table.js";

test("Table - exports correctly", () => {
	assert(typeof Table === "function");
});

test("TableHeader - exports correctly", () => {
	assert(typeof TableHeader === "function");
});

test("TableBody - exports correctly", () => {
	assert(typeof TableBody === "function");
});

test("TableRow - exports correctly", () => {
	assert(typeof TableRow === "function");
});

test("TableHead - exports correctly", () => {
	assert(typeof TableHead === "function");
});

test("TableCell - exports correctly", () => {
	assert(typeof TableCell === "function");
});

test("Table - renders with default props", () => {
	const result = Table({});
	assert.ok(result);
});

test("TableHeader - renders with default props", () => {
	const result = TableHeader({});
	assert.ok(result);
});

test("TableBody - renders with default props", () => {
	const result = TableBody({});
	assert.ok(result);
});

test("TableRow - renders with default props", () => {
	const result = TableRow({});
	assert.ok(result);
});

test("TableHead - renders with default props", () => {
	const result = TableHead({});
	assert.ok(result);
});

test("TableCell - renders with default props", () => {
	const result = TableCell({});
	assert.ok(result);
});

test("Table - accepts className override", () => {
	const result = Table({ className: "custom" });
	assert.ok(result);
});
