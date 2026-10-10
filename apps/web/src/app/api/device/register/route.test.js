import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve the @/ alias used by route files.
// `register/` is 5 levels below apps/web (register → device → api → app → src → web).
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is cached
// after the first call, so a later `mock.module` would not reach the bindings the
// route already holds.
//
// `extractBearerPayload` is mocked at the boundary rather than a real JWT being
// signed: this route's job is *which* subject it takes and what it does with it, and
// the signature verification is already covered by jwt.test.js. Every call is
// recorded so "did this route read the Authorization header at all" is observable.

const jwtUrl = pathToFileURL(
	new URL("../../../../lib/jwt.js", import.meta.url).pathname,
).href;

/** What `extractBearerPayload` resolves to for the current test. */
let tokenPayload;
/** When set, `extractBearerPayload` rejects with this error. */
let bearerError;
/** Every Request object the route handed to `extractBearerPayload`. */
let bearerRequests;

mock.module(jwtUrl, {
	namedExports: {
		extractBearerPayload: async (request) => {
			bearerRequests.push(request);
			if (bearerError) throw bearerError;
			return tokenPayload;
		},
	},
});

const core = await import("@usequark/quark-core/core");

mock.module("@usequark/quark-core/core", {
	namedExports: {
		...core,
		createLogger: () => ({
			info() {},
			error() {},
			warn() {},
			debug() {},
		}),
	},
});

// ── Prisma mock ──────────────────────────────────────────────────────────────
//
// `prisma.device.upsert` reaches the client through the global Prisma stub, matching
// how `packages/db/src/client.js` resolves it.
//
// `create` is present too, and counted separately, so "upserted rather than
// duplicated" is observable: a route that reached for `create` would otherwise fail
// with a TypeError, which is a different failure from the one being pinned.

let originalPrisma;

/** When set, `device.upsert` rejects with this error. */
let upsertError;
/** Every `upsert` argument the route issued, in order. */
let upserts;
/** Every `create` argument the route issued, in order. */
let creates;

function setPrismaMock() {
	globalThis.__prisma = {
		device: {
			upsert: mock.fn(async (args) => {
				if (upsertError) throw upsertError;
				upserts.push(args);
				return { id: "device-row-1", ...args.create };
			}),
			create: mock.fn(async (args) => {
				creates.push(args);
				return { id: "device-row-1", ...args.data };
			}),
		},
	};
}

/** A payload as `extractBearerPayload` returns it for a valid mobile token. */
const PAYLOAD = {
	sub: "user-1",
	email: "alice@example.com",
	name: "Alice",
	role: "viewer",
};

const VALID_BODY = {
	platform: "ios",
	pushToken: "apns-device-token",
	deviceId: "device-abc",
};

const { POST } = await import("./route.js");

/** A POST to /api/device/register with a Bearer header. */
function registerRequest(body = VALID_BODY, headers = {}) {
	return new Request("http://localhost/api/device/register", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: "Bearer a.b.c",
			...headers,
		},
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

function resetFixtures() {
	tokenPayload = { ...PAYLOAD };
	bearerError = null;
	bearerRequests = [];
	upsertError = null;
	upserts = [];
	creates = [];
}

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	resetFixtures();
	setPrismaMock();
});

afterEach(() => {
	if (originalPrisma !== undefined) {
		globalThis.__prisma = originalPrisma;
	} else {
		delete globalThis.__prisma;
	}
	mock.restoreAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("POST /api/device/register upserts the device for the token's subject", async () => {
	const response = await POST(registerRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(body, { success: true });
	// The userId comes from the verified token, not from the request body. A body
	// the client controls naming the user would let anyone register a push token on
	// someone else's account and receive their notifications.
	assert.deepStrictEqual(upserts, [
		{
			where: { userId_deviceId: { userId: "user-1", deviceId: "device-abc" } },
			update: { pushToken: "apns-device-token", platform: "ios" },
			create: {
				userId: "user-1",
				platform: "ios",
				pushToken: "apns-device-token",
				deviceId: "device-abc",
			},
		},
	]);
	// Upsert, not create: the two statements take the same arguments apart, so only
	// checking the recorded call distinguishes them.
	assert.deepStrictEqual(creates, []);
});

test("the Bearer token is what the route authenticates on", async () => {
	const request = registerRequest();

	await POST(request);

	// Pins that the route reads the request's Authorization header rather than
	// consulting a session or a body field. Without this the suite would still pass
	// if the subject came from anywhere else, since the payload mock answers
	// identically for every request.
	assert.deepStrictEqual(bearerRequests, [request]);
});

test("POST ignores a userId supplied in the body", async () => {
	// The escalation guard for this route. The subject is the verified token's, and
	// nothing in the body may redirect the write: registering a push token against
	// another account is how an attacker starts receiving someone else's
	// notifications, and `userId` is not in the schema so it is stripped anyway.
	await POST(
		registerRequest({ ...VALID_BODY, userId: "user-2", sub: "user-2" }),
	);

	assert.strictEqual(upserts[0].create.userId, "user-1");
	assert.deepStrictEqual(upserts[0].where, {
		userId_deviceId: { userId: "user-1", deviceId: "device-abc" },
	});
});

test("an unauthenticated request is rejected before the body is parsed", async () => {
	tokenPayload = null;

	// Malformed body on purpose: if validation ran first the client would see a
	// 400 and conclude the payload was wrong, when the actual problem is the missing
	// token. Authentication has to come first.
	const response = await POST(
		registerRequest({ platform: "windows", pushToken: "", deviceId: "" }),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Authentication required");
	assert.deepStrictEqual(upserts, []);
});

test("a token with no subject claim is rejected", async () => {
	// `payload?.sub` — a verified token that carries no `sub` identifies nobody, and
	// `userId: undefined` would otherwise be written straight into the where clause.
	tokenPayload = { email: "alice@example.com" };

	const response = await POST(registerRequest());

	assert.strictEqual(response.status, 401);
	assert.deepStrictEqual(upserts, []);
});

test("a bearer extraction failure surfaces as a 500", async () => {
	// The request had a token-shaped header, so 401 would tell the client to discard
	// a credential that may be perfectly valid. This is a server fault.
	bearerError = new Error("jose: unexpected key length");

	const response = await POST(registerRequest());

	assert.strictEqual(response.status, 500);
	assert.deepStrictEqual(upserts, []);
});

test("re-registering the same device rotates the token instead of duplicating the row", async () => {
	// The `where` is the `@@unique([userId, deviceId])` compound key, so a re-install
	// updates the existing row. Keyed on `deviceId` alone it would either create a
	// duplicate (two live push tokens for one phone, both receiving every
	// notification) or fail on the unique constraint.
	await POST(registerRequest());
	await POST(
		registerRequest({
			platform: "ios",
			pushToken: "apns-device-token-rotated",
			deviceId: "device-abc",
		}),
	);

	assert.strictEqual(upserts.length, 2);
	// One upsert per registration and no plain `create`: a `create` here would
	// insert a second row for the same phone instead of rotating its token.
	assert.deepStrictEqual(creates, []);
	for (const args of upserts) {
		assert.deepStrictEqual(args.where, {
			userId_deviceId: { userId: "user-1", deviceId: "device-abc" },
		});
	}
	assert.strictEqual(upserts[1].update.pushToken, "apns-device-token-rotated");
	// `userId` and `deviceId` are the identity half of the unique key — rewriting
	// them on update would make the row collide with itself.
	assert.deepStrictEqual(Object.keys(upserts[1].update).sort(), [
		"platform",
		"pushToken",
	]);
});

test("two users registering the same deviceId get separate rows", async () => {
	// `userId` is part of the unique key precisely so a shared/handed-over device
	// identifier cannot overwrite another user's row. Asserting the compound key is
	// what stops this from silently becoming a takeover primitive.
	tokenPayload = { sub: "user-2" };

	await POST(registerRequest());

	assert.deepStrictEqual(upserts[0].where, {
		userId_deviceId: { userId: "user-2", deviceId: "device-abc" },
	});
	assert.strictEqual(upserts[0].create.userId, "user-2");
});

test("POST returns 400 for an unsupported platform and writes nothing", async () => {
	// APNs and FCM only — accepting an unknown platform would store a token that can
	// never be delivered, and it is silently accepted today if the enum is loosened.
	const response = await POST(
		registerRequest({ ...VALID_BODY, platform: "windows" }),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.name, "ValidationError");
	assert.deepStrictEqual(upserts, []);
});

test("POST returns 400 for a missing pushToken or deviceId", async () => {
	for (const missing of ["pushToken", "deviceId"]) {
		const body = { ...VALID_BODY };
		delete body[missing];

		const response = await POST(registerRequest(body));

		assert.strictEqual(response.status, 400, `${missing} was accepted`);
	}
	assert.deepStrictEqual(upserts, []);
});

test("POST returns 400 for a body that is not JSON", async () => {
	const response = await POST(registerRequest("{not json"));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	// A malformed body must not reach the device table, and must not be reported
	// as the schema error it is not.
	assert.match(body.message, /JSON/i);
	assert.deepStrictEqual(upserts, []);
});

test("a failed write is not reported as a success", async () => {
	// `{ success: true }` on a failed upsert tells the mobile client its token is
	// registered when it is not, and the client then has no way to know to retry.
	upsertError = new Error("connect ECONNREFUSED 10.0.0.5:5432");

	const response = await POST(registerRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 500);
	assert.notStrictEqual(body.success, true);
	assert.strictEqual(
		globalThis.__prisma.device.upsert.mock.callCount(),
		1,
		"the write was never attempted, so the 500 came from somewhere else",
	);
});

test("the route reports success without echoing the push token back", async () => {
	const response = await POST(registerRequest());
	const raw = await response.text();

	// A push token is a delivery address; reflecting it widens the blast radius of
	// anything that logs a response body.
	assert.ok(
		!raw.includes("apns-device-token"),
		`response echoed the push token: ${raw}`,
	);
});
