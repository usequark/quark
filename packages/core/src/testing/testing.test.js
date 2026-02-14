import assert from "node:assert/strict";
import { test } from "node:test";
import {
	assertThrows,
	captureConsole,
	createMockPrisma,
	createMockRedis,
	createMockRequest,
	createMockResponse,
	createTestContext,
	createTestPost,
	createTestSession,
	createTestUser,
	waitFor,
} from "./index.js";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

test("Factories", async (t) => {
	await t.test("createTestUser returns correct shape with defaults", () => {
		const user = createTestUser();
		assert.ok(user.id.startsWith("user_"));
		assert.ok(user.email.includes("@example.com"));
		assert.strictEqual(user.name, "Test User");
		assert.strictEqual(user.role, "viewer");
		assert.strictEqual(user.password, null);
		assert.strictEqual(user.image, null);
		assert.strictEqual(user.emailVerified, null);
		assert.ok(user.createdAt instanceof Date);
		assert.ok(user.updatedAt instanceof Date);
	});

	await t.test("createTestUser applies overrides", () => {
		const user = createTestUser({
			id: "custom_id",
			name: "Alice",
			role: "admin",
			email: "alice@test.com",
		});
		assert.strictEqual(user.id, "custom_id");
		assert.strictEqual(user.name, "Alice");
		assert.strictEqual(user.role, "admin");
		assert.strictEqual(user.email, "alice@test.com");
	});

	await t.test("createTestUser generates unique IDs", () => {
		const a = createTestUser();
		const b = createTestUser();
		assert.notStrictEqual(a.id, b.id);
		assert.notStrictEqual(a.email, b.email);
	});

	await t.test("createTestPost returns correct shape with defaults", () => {
		const post = createTestPost();
		assert.ok(post.id.startsWith("post_"));
		assert.strictEqual(post.title, "Test Post");
		assert.strictEqual(post.content, "Test content");
		assert.strictEqual(post.published, false);
		assert.ok(post.authorId.startsWith("user_"));
		assert.ok(post.createdAt instanceof Date);
		assert.ok(post.updatedAt instanceof Date);
	});

	await t.test(
		"createTestPost applies overrides including boolean false",
		() => {
			const post = createTestPost({ published: true, title: "Custom" });
			assert.strictEqual(post.published, true);
			assert.strictEqual(post.title, "Custom");
		},
	);

	await t.test(
		"createTestPost keeps published false when explicitly set",
		() => {
			const post = createTestPost({ published: false });
			assert.strictEqual(post.published, false);
		},
	);

	await t.test("createTestSession returns session with embedded user", () => {
		const session = createTestSession();
		assert.ok(session.user);
		assert.ok(session.user.id.startsWith("user_"));
		assert.ok(session.user.email.includes("@example.com"));
		assert.strictEqual(session.user.name, "Test User");
		assert.strictEqual(session.user.role, "viewer");
		assert.ok(session.expires);
	});

	await t.test("createTestSession applies user overrides", () => {
		const session = createTestSession({
			user: { role: "admin", name: "Admin" },
		});
		assert.strictEqual(session.user.role, "admin");
		assert.strictEqual(session.user.name, "Admin");
	});

	await t.test("createTestSession applies top-level overrides", () => {
		const expires = "2099-01-01T00:00:00.000Z";
		const session = createTestSession({ expires });
		assert.strictEqual(session.expires, expires);
	});
});

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

test("Mock Prisma", async (t) => {
	await t.test("records method calls with args", async () => {
		const prisma = createMockPrisma();
		await prisma.user.findUnique({ where: { id: "1" } });
		assert.strictEqual(prisma.calls.length, 1);
		assert.strictEqual(prisma.calls[0].model, "user");
		assert.strictEqual(prisma.calls[0].method, "findUnique");
		assert.deepStrictEqual(prisma.calls[0].args, [{ where: { id: "1" } }]);
	});

	await t.test("returns null by default for unconfigured methods", async () => {
		const prisma = createMockPrisma();
		const result = await prisma.user.findUnique({ where: { id: "1" } });
		assert.strictEqual(result, null);
	});

	await t.test("returns configured values via mockReturn", async () => {
		const prisma = createMockPrisma();
		const fakeUser = { id: "1", name: "Test" };
		prisma.mockReturn("user", "findUnique", fakeUser);

		const result = await prisma.user.findUnique({ where: { id: "1" } });
		assert.deepStrictEqual(result, fakeUser);
	});

	await t.test("supports function return values", async () => {
		const prisma = createMockPrisma();
		prisma.mockReturn("user", "create", (args) => ({
			id: "new_1",
			...args.data,
		}));

		const result = await prisma.user.create({ data: { name: "Alice" } });
		assert.strictEqual(result.id, "new_1");
		assert.strictEqual(result.name, "Alice");
	});

	await t.test("supports overrides in constructor", async () => {
		const prisma = createMockPrisma({
			user: { findMany: [{ id: "1" }, { id: "2" }] },
		});
		const result = await prisma.user.findMany();
		assert.deepStrictEqual(result, [{ id: "1" }, { id: "2" }]);
	});

	await t.test("reset clears calls and return values", async () => {
		const prisma = createMockPrisma();
		prisma.mockReturn("user", "findUnique", { id: "1" });
		await prisma.user.findUnique({ where: { id: "1" } });

		prisma.reset();
		assert.strictEqual(prisma.calls.length, 0);

		const result = await prisma.user.findUnique({ where: { id: "1" } });
		assert.strictEqual(result, null);
	});

	await t.test("handles multiple models independently", async () => {
		const prisma = createMockPrisma();
		prisma.mockReturn("user", "findMany", []);
		prisma.mockReturn("post", "findMany", [{ id: "p1" }]);

		const users = await prisma.user.findMany();
		const posts = await prisma.post.findMany();

		assert.deepStrictEqual(users, []);
		assert.deepStrictEqual(posts, [{ id: "p1" }]);
		assert.strictEqual(prisma.calls.length, 2);
	});
});

// ---------------------------------------------------------------------------
// Mock Request
// ---------------------------------------------------------------------------

test("Mock Request", async (t) => {
	await t.test("has correct defaults", () => {
		const req = createMockRequest();
		assert.strictEqual(req.method, "GET");
		assert.strictEqual(req.url, "http://localhost/api/test");
	});

	await t.test("headers.get is case-insensitive", () => {
		const req = createMockRequest({
			headers: { "Content-Type": "application/json" },
		});
		assert.strictEqual(req.headers.get("content-type"), "application/json");
		assert.strictEqual(req.headers.get("Content-Type"), "application/json");
	});

	await t.test("returns null for missing headers", () => {
		const req = createMockRequest();
		assert.strictEqual(req.headers.get("x-missing"), null);
	});

	await t.test("json() returns body", async () => {
		const body = { name: "Test" };
		const req = createMockRequest({ method: "POST", body });
		const result = await req.json();
		assert.deepStrictEqual(result, body);
	});

	await t.test("cookies.get returns cookie object", () => {
		const req = createMockRequest({ cookies: { session: "abc123" } });
		const cookie = req.cookies.get("session");
		assert.deepStrictEqual(cookie, { name: "session", value: "abc123" });
	});

	await t.test("cookies.get returns undefined for missing cookie", () => {
		const req = createMockRequest();
		assert.strictEqual(req.cookies.get("missing"), undefined);
	});

	await t.test("nextUrl is a URL object", () => {
		const req = createMockRequest({ url: "http://localhost/api/test?q=hello" });
		assert.ok(req.nextUrl instanceof URL);
		assert.strictEqual(req.nextUrl.searchParams.get("q"), "hello");
		assert.strictEqual(req.nextUrl.pathname, "/api/test");
	});
});

// ---------------------------------------------------------------------------
// Mock Response
// ---------------------------------------------------------------------------

test("Mock Response", async (t) => {
	await t.test("has default status 200", () => {
		const res = createMockResponse();
		assert.strictEqual(res.status, 200);
	});

	await t.test("json() sets body and content-type", () => {
		const res = createMockResponse();
		const returned = res.json({ success: true });
		assert.deepStrictEqual(res.body, { success: true });
		assert.strictEqual(res.headers.get("content-type"), "application/json");
		assert.strictEqual(returned, res); // chainable
	});

	await t.test("redirect() sets status and location", () => {
		const res = createMockResponse();
		res.redirect("/login");
		assert.strictEqual(res.status, 302);
		assert.strictEqual(res.headers.get("location"), "/login");
	});

	await t.test("cookies can be set and retrieved", () => {
		const res = createMockResponse();
		res.cookies.set("token", "abc");
		assert.strictEqual(res.cookies.get("token"), "abc");
		assert.ok(res.cookies.has("token"));
	});
});

// ---------------------------------------------------------------------------
// Mock Redis
// ---------------------------------------------------------------------------

test("Mock Redis", async (t) => {
	await t.test("get/set stores and retrieves values", async () => {
		const redis = createMockRedis();
		await redis.set("key", "value");
		const result = await redis.get("key");
		assert.strictEqual(result, "value");
	});

	await t.test("get returns null for missing keys", async () => {
		const redis = createMockRedis();
		const result = await redis.get("missing");
		assert.strictEqual(result, null);
	});

	await t.test("initialData pre-populates the store", async () => {
		const redis = createMockRedis({ greeting: "hello" });
		const result = await redis.get("greeting");
		assert.strictEqual(result, "hello");
	});

	await t.test("del removes keys and returns count", async () => {
		const redis = createMockRedis({ a: "1", b: "2", c: "3" });
		const count = await redis.del("a", "c");
		assert.strictEqual(count, 2);
		assert.strictEqual(await redis.get("a"), null);
		assert.strictEqual(await redis.get("b"), "2");
	});

	await t.test("keys filters by prefix pattern", async () => {
		const redis = createMockRedis({
			"sess:1": "a",
			"sess:2": "b",
			"cache:1": "c",
		});
		const keys = await redis.keys("sess:*");
		assert.deepStrictEqual(keys.sort(), ["sess:1", "sess:2"]);
	});

	await t.test("incr increments numeric values", async () => {
		const redis = createMockRedis();
		const v1 = await redis.incr("counter");
		const v2 = await redis.incr("counter");
		assert.strictEqual(v1, 1);
		assert.strictEqual(v2, 2);
	});

	await t.test("exists returns count of existing keys", async () => {
		const redis = createMockRedis({ a: "1" });
		assert.strictEqual(await redis.exists("a"), 1);
		assert.strictEqual(await redis.exists("b"), 0);
		assert.strictEqual(await redis.exists("a", "b"), 1);
	});

	await t.test("pipeline batches commands", async () => {
		const redis = createMockRedis();
		await redis.set("x", "1");
		const results = await redis.pipeline().get("x").set("y", "2").exec();
		assert.strictEqual(results.length, 2);
		assert.deepStrictEqual(results[0], [null, "1"]);
		assert.deepStrictEqual(results[1], [null, "OK"]);
		assert.strictEqual(await redis.get("y"), "2");
	});

	await t.test("records all method calls", async () => {
		const redis = createMockRedis();
		await redis.set("k", "v");
		await redis.get("k");
		assert.strictEqual(redis.calls.length, 2);
		assert.strictEqual(redis.calls[0].method, "set");
		assert.strictEqual(redis.calls[1].method, "get");
	});

	await t.test("reset clears store and calls", async () => {
		const redis = createMockRedis({ a: "1" });
		await redis.get("a");
		redis.reset();
		assert.strictEqual(redis.calls.length, 0);
		assert.strictEqual(await redis.get("a"), null);
	});

	await t.test("ping returns PONG", async () => {
		const redis = createMockRedis();
		assert.strictEqual(await redis.ping(), "PONG");
	});
});

// ---------------------------------------------------------------------------
// captureConsole
// ---------------------------------------------------------------------------

test("captureConsole", async (t) => {
	await t.test("captures console output and restores", () => {
		const originalLog = console.log;
		const { output, restore } = captureConsole();

		console.log("hello", "world");
		console.warn("warning");
		console.error("error");

		assert.strictEqual(output.length, 3);
		assert.strictEqual(output[0].method, "log");
		assert.deepStrictEqual(output[0].args, ["hello", "world"]);
		assert.strictEqual(output[1].method, "warn");
		assert.strictEqual(output[2].method, "error");

		restore();
		assert.strictEqual(console.log, originalLog);
	});

	await t.test("captures info and debug", () => {
		const { output, restore } = captureConsole();
		console.info("info msg");
		console.debug("debug msg");
		restore();

		assert.strictEqual(output.length, 2);
		assert.strictEqual(output[0].method, "info");
		assert.strictEqual(output[1].method, "debug");
	});
});

// ---------------------------------------------------------------------------
// createTestContext
// ---------------------------------------------------------------------------

test("createTestContext", async (t) => {
	await t.test("saves and restores env variables", async () => {
		const original = process.env.TEST_CTX_VAR;
		const ctx = createTestContext();

		ctx.setEnv("TEST_CTX_VAR", "modified");
		assert.strictEqual(process.env.TEST_CTX_VAR, "modified");

		await ctx.cleanup();
		assert.strictEqual(process.env.TEST_CTX_VAR, original);
	});

	await t.test("deletes env var when set to undefined", () => {
		const ctx = createTestContext();
		process.env.TEST_CTX_DEL = "exists";
		ctx.setEnv("TEST_CTX_DEL", undefined);
		assert.strictEqual(process.env.TEST_CTX_DEL, undefined);
		ctx.restoreEnv();
		assert.strictEqual(process.env.TEST_CTX_DEL, "exists");
		delete process.env.TEST_CTX_DEL;
	});

	await t.test("runs cleanup functions in LIFO order", async () => {
		const ctx = createTestContext();
		const order = [];
		ctx.onCleanup(() => order.push("first"));
		ctx.onCleanup(() => order.push("second"));
		ctx.onCleanup(() => order.push("third"));

		await ctx.cleanup();
		assert.deepStrictEqual(order, ["third", "second", "first"]);
	});

	await t.test("cleanup runs async cleanup functions", async () => {
		const ctx = createTestContext();
		let cleaned = false;
		ctx.onCleanup(async () => {
			await new Promise((r) => setTimeout(r, 10));
			cleaned = true;
		});

		await ctx.cleanup();
		assert.ok(cleaned);
	});
});

// ---------------------------------------------------------------------------
// waitFor
// ---------------------------------------------------------------------------

test("waitFor", async (t) => {
	await t.test("resolves when assertion passes immediately", async () => {
		await waitFor(() => {
			assert.ok(true);
		});
	});

	await t.test("resolves when assertion eventually passes", async () => {
		let count = 0;
		await waitFor(
			() => {
				count++;
				if (count < 3) throw new Error("not yet");
			},
			{ timeout: 1000, interval: 10 },
		);
		assert.ok(count >= 3);
	});

	await t.test("throws last error on timeout", async () => {
		await assert.rejects(
			() =>
				waitFor(
					() => {
						throw new Error("always fails");
					},
					{ timeout: 100, interval: 10 },
				),
			{ message: "always fails" },
		);
	});
});

// ---------------------------------------------------------------------------
// assertThrows
// ---------------------------------------------------------------------------

test("assertThrows", async (t) => {
	await t.test("passes when async function throws expected error", async () => {
		const err = await assertThrows(
			async () => {
				throw new TypeError("bad input");
			},
			TypeError,
			/bad input/,
		);
		assert.ok(err instanceof TypeError);
	});

	await t.test("fails when function does not throw", async () => {
		await assert.rejects(
			() => assertThrows(async () => "ok", Error),
			/Expected function to throw/,
		);
	});

	await t.test("fails when error class does not match", async () => {
		await assert.rejects(
			() =>
				assertThrows(async () => {
					throw new RangeError("oops");
				}, TypeError),
			/Expected error to be instance of TypeError/,
		);
	});

	await t.test("fails when message pattern does not match", async () => {
		await assert.rejects(() =>
			assertThrows(
				async () => {
					throw new Error("actual message");
				},
				Error,
				/completely different/,
			),
		);
	});

	await t.test("works with string message pattern", async () => {
		const err = await assertThrows(
			async () => {
				throw new Error("validation failed: invalid email");
			},
			Error,
			"invalid email",
		);
		assert.ok(err.message.includes("invalid email"));
	});

	await t.test("works without ErrorClass (just message)", async () => {
		await assertThrows(
			async () => {
				throw new Error("something broke");
			},
			undefined,
			/something broke/,
		);
	});
});
