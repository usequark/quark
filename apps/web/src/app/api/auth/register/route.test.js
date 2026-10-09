import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { ValidationError } from "@usequark/quark-core/errors";

// Resolve the @/ alias used by route files.
// `register/` is 5 levels below apps/web (auth → api → app → src → web), so
// `src/lib/` is 4 levels up from here.
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is
// cached after the first call, so a later `mock.module` would not reach the
// bindings the route already holds.

const signupUrl = pathToFileURL(
	new URL("../../../../lib/auth-signup.js", import.meta.url).pathname,
).href;

/**
 * Every boundary the route crossed, in order.
 *
 * Populated by the mocks below rather than asserted against each mock
 * individually, so a test can pin that the duplicate check happens *before* the
 * hash rather than after it.
 */
let steps;

/** Result of `isSignupEnabled()` for the current test. */
let signupEnabled;

mock.module(signupUrl, {
	namedExports: {
		isSignupEnabled: () => {
			steps.push("signup");
			return signupEnabled;
		},
	},
});

// `userRegisterSchema` is the real one: the point of the validation tests is
// that this route applies *that* schema, and a stubbed schema would make them
// pass by construction.
const db = await import("@usequark/quark-db");

/** The row `user.findByEmail` resolves to, or null. */
let existingUser;
/** The row `user.create` resolves to. */
let createdUser;
/** When set, `user.create` rejects with this error instead. */
let createError;
/** Every payload `user.create` was handed. */
let createCalls;
let findByEmailCalls;

mock.module("@usequark/quark-db", {
	namedExports: {
		...db,
		user: {
			findByEmail: async (email) => {
				steps.push(`findByEmail:${email}`);
				findByEmailCalls.push(email);
				return existingUser;
			},
			create: async (data) => {
				steps.push("create");
				createCalls.push(data);
				if (createError) throw createError;
				return { ...createdUser };
			},
		},
	},
});

const core = await import("@usequark/quark-core");

/** Every plaintext passed to `hashPassword`. */
let hashCalls;
/** The digest `hashPassword` resolves to. */
let hashedPassword;
/** `{ queue, job, data }` for every job the route enqueued. */
let queueCalls;
/** When set, `emailQueue.add` rejects with this error. */
let queueAddError;

mock.module("@usequark/quark-core", {
	namedExports: {
		...core,
		createLogger: () => ({
			info() {},
			error() {},
			warn() {},
			debug() {},
		}),
		hashPassword: async (password) => {
			steps.push(`hash:${password}`);
			hashCalls.push(password);
			return hashedPassword;
		},
		createQueue: (name) => ({
			add: async (job, data) => {
				steps.push(`queue.add:${job}`);
				if (queueAddError) throw queueAddError;
				queueCalls.push({ queue: name, job, data });
			},
		}),
	},
});

const VALID_BODY = {
	email: "new-user@example.com",
	name: "New User",
	password: "Str0ngPassphrase",
};

/**
 * The row `user.create` returns.
 *
 * It deliberately *includes* a password. `user.create` selects a projection
 * that excludes the column, so the route's `const { password, ...rest }` is
 * redundant against today's query — which is exactly why it must be asserted
 * against a record that still has one, rather than against a mock that quietly
 * agrees with the route.
 */
const CREATED = {
	id: "user-new",
	email: VALID_BODY.email,
	name: VALID_BODY.name,
	password: "hashed:Str0ngPassphrase",
	role: "viewer",
};

const { POST } = await import("./route.js");

/** A register request carrying the headers a CSRF-protected POST would need. */
function registerRequest(body = VALID_BODY) {
	return new Request("http://localhost/api/auth/register", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			cookie: "csrf_token=test-csrf-token",
			"x-csrf-token": "test-csrf-token",
		},
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

/**
 * Every boundary the route crossed, in order.
 *
 * Populated by the mocks above rather than asserted against each mock
 * individually, so a test can pin that the duplicate check happens *before* the
 * hash rather than after it.
 */
function resetFixtures() {
	steps = [];
	signupEnabled = true;
	existingUser = null;
	createdUser = CREATED;
	createError = null;
	createCalls = [];
	findByEmailCalls = [];
	hashCalls = [];
	hashedPassword = "hashed:Str0ngPassphrase";
	queueCalls = [];
	queueAddError = null;
}

beforeEach(() => {
	resetFixtures();
});

afterEach(() => {
	mock.restoreAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("POST /api/auth/register creates the user and answers 201", async () => {
	const response = await POST(registerRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 201);
	assert.strictEqual(body.id, "user-new");
	assert.strictEqual(body.email, VALID_BODY.email);
	assert.strictEqual(body.name, VALID_BODY.name);
	assert.deepStrictEqual(createCalls, [
		{
			email: VALID_BODY.email,
			name: VALID_BODY.name,
			password: "hashed:Str0ngPassphrase",
		},
	]);
});

test("POST never returns the password, even when the created row carries one", async () => {
	// The hash is the credential. `user.create` selects a projection without the
	// column today, so a regression that drops that select would start handing
	// every new user their own bcrypt digest, and a regression in the select is
	// invisible to a test whose mock returns a row with no password in it.
	const response = await POST(registerRequest());
	const raw = await response.text();

	assert.strictEqual(response.status, 201);
	assert.ok(
		!raw.includes("hashed:"),
		`register response leaked the password hash: ${raw}`,
	);
	assert.ok(
		!("password" in JSON.parse(raw)),
		`register response has a password key: ${raw}`,
	);
});

test("POST passes the hash to user.create and never the plaintext", async () => {
	await POST(registerRequest());

	// The password must reach bcrypt, and the *digest* must reach the database.
	// Both directions matter: hashing the hash logs nobody in, storing the
	// plaintext hands the database a credential nobody can rotate.
	assert.deepStrictEqual(hashCalls, ["Str0ngPassphrase"]);
	assert.strictEqual(createCalls[0].password, "hashed:Str0ngPassphrase");
	assert.notStrictEqual(createCalls[0].password, "Str0ngPassphrase");
	for (const [key, value] of Object.entries(createCalls[0])) {
		assert.notStrictEqual(
			value,
			"Str0ngPassphrase",
			`plaintext password leaked into create payload field "${key}"`,
		);
	}
});

test("POST writes only the schema fields, so a client cannot set its own role", async () => {
	// `role` is a column with a default of `viewer`. If anything other than the
	// parsed `data` reached `user.create`, a caller could send `role: "admin"`
	// and mint themselves an administrator at signup.
	const response = await POST(
		registerRequest({ ...VALID_BODY, role: "admin", emailVerified: true }),
	);

	assert.strictEqual(response.status, 201);
	assert.deepStrictEqual(Object.keys(createCalls[0]).sort(), [
		"email",
		"name",
		"password",
	]);
	assert.strictEqual(createCalls[0].role, undefined);
});

test("POST checks for a duplicate before spending a hash", async () => {
	existingUser = { id: "user-1", email: VALID_BODY.email };

	const response = await POST(registerRequest());

	assert.strictEqual(response.status, 409);
	assert.strictEqual(
		(await response.json()).message,
		"User with this email already exists",
	);
	// Hashing for an address that is already taken is pure waste, and the
	// ordering is what makes the duplicate path cheap rather than merely correct.
	assert.deepStrictEqual(hashCalls, []);
	assert.deepStrictEqual(createCalls, []);
	assert.deepStrictEqual(queueCalls, []);
	assert.deepStrictEqual(steps, ["signup", `findByEmail:${VALID_BODY.email}`]);
});

test("POST runs signup gate, lookup, hash and write in that order", async () => {
	await POST(registerRequest());

	// The whole ordering in one assertion. Swapping the duplicate check and the
	// hash passes every other test here; swapping the write and the enqueue
	// would email a user id that does not exist yet.
	assert.deepStrictEqual(steps, [
		"signup",
		`findByEmail:${VALID_BODY.email}`,
		"hash:Str0ngPassphrase",
		"create",
		"queue.add:send-welcome-email",
	]);
});

test("POST enqueues the welcome email for the user it just created", async () => {
	await POST(registerRequest());

	// The payload has to carry the new id, not the email: the worker's
	// validation rejects a job with no userId.
	assert.deepStrictEqual(queueCalls, [
		{
			queue: "email-queue",
			job: "send-welcome-email",
			data: { userId: "user-new" },
		},
	]);
});

test("POST returns 403 and writes nothing when signup is disabled", async () => {
	signupEnabled = false;

	const response = await POST(registerRequest());

	assert.strictEqual(response.status, 403);
	assert.strictEqual(
		(await response.json()).message,
		"Registration is disabled.",
	);
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(createCalls, []);
	assert.deepStrictEqual(queueCalls, []);
});

test("POST applies the signup gate before it validates the body", async () => {
	signupEnabled = false;

	// A body that would fail the schema. If validation ran first the caller
	// would get a 400 describing the password rules of a feature that is off —
	// which both confirms the route exists and hands an attacker the rules.
	const response = await POST(
		registerRequest({ email: "not-an-email", password: "x" }),
	);

	assert.strictEqual(response.status, 403);
	assert.deepStrictEqual(steps, ["signup"]);
});

test("POST returns 400 for a password the schema rejects, before any lookup", async () => {
	const response = await POST(
		registerRequest({ email: VALID_BODY.email, password: "weak" }),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.code, "VALIDATION_ERROR");
	// The duplicate check must not run on an unvalidated address: `findByEmail`
	// would otherwise be reachable as an email-enumeration oracle for anyone who
	// can make the password rules fail.
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(createCalls, []);
});

test("POST returns 400 for a missing body", async () => {
	const response = await POST(registerRequest(""));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.name, "ValidationError");
	assert.deepStrictEqual(createCalls, []);
});

test("POST still returns 201 when the welcome email cannot be enqueued", async () => {
	queueAddError = new Error("connect ECONNREFUSED redis://cache:6379");

	const response = await POST(registerRequest());
	const body = await response.json();

	// The user exists in the database now. Failing the whole request would tell
	// the caller to retry, and the retry would be a 409 for an address they have
	// every reason to believe they just created.
	assert.strictEqual(response.status, 201);
	assert.strictEqual(body.id, "user-new");
	assert.deepStrictEqual(createCalls.length, 1);
});

test("POST returns 500 and enqueues nothing when the insert fails", async () => {
	createError = Object.assign(
		new Error("Unique constraint failed on the fields: (`email`)"),
		{ code: "P2002" },
	);

	const response = await POST(registerRequest());
	const raw = await response.text();

	assert.strictEqual(response.status, 500);
	assert.strictEqual(JSON.parse(raw).code, "INTERNAL_ERROR");
	// The error-handler fallback must not echo the driver's message: P2002
	// messages carry the column and the colliding value.
	assert.ok(
		!raw.includes("Unique constraint"),
		`error body leaked the database message: ${raw}`,
	);
	// The write failed, so there is no user to welcome.
	assert.deepStrictEqual(queueCalls, []);
	assert.deepStrictEqual(
		steps.filter((s) => s.startsWith("queue.add")),
		[],
	);
});

test("POST turns a thrown error into a response instead of propagating it", async () => {
	createError = new ValidationError("prisma exploded");

	const response = await POST(registerRequest());

	// Every branch inside the try is a thrown AppError, and handleError maps
	// AppError to its own status. A route that let it escape would turn a
	// handled failure into an unhandled rejection in the Next.js request path.
	assert.strictEqual(response.status, 400);
	assert.strictEqual((await response.json()).code, "VALIDATION_ERROR");
});

test("POST rejects a cross-site request that carries no CSRF token", async () => {
	// This wrapper used to be inert. `requireCsrfToken` returned early for every
	// path under `/api/auth/`, written for NextAuth's `[...nextauth]` catch-all,
	// so a cookie-bearing browser could be POSTed here from another origin and
	// create an account — precisely what the wrapper was added to prevent.
	//
	// A real cross-site POST arrives without the `csrf_token` cookie: it is
	// SameSite=Strict, so the browser withholds it. That is the forgery, and it
	// must die here rather than inside the handler.
	const response = await POST(
		new Request("http://localhost/api/auth/register", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(VALID_BODY),
		}),
	);

	assert.strictEqual(response.status, 401);
	assert.deepStrictEqual(
		createCalls,
		[],
		"an account was created from a request with no CSRF token",
	);
	assert.deepStrictEqual(
		steps.filter((s) => s.startsWith("queue.add")),
		[],
		"a welcome email was enqueued for an account that was never created",
	);
});

test("POST rejects a forged header when the cookie is absent", async () => {
	// The header alone proves nothing — it is the pairing with the httpOnly
	// cookie that does. A cross-site page can set a header but cannot read or set
	// the cookie, so a token without one must not be believed.
	const response = await POST(
		new Request("http://localhost/api/auth/register", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-csrf-token": "guessed-token",
			},
			body: JSON.stringify(VALID_BODY),
		}),
	);

	assert.strictEqual(response.status, 401);
	assert.deepStrictEqual(createCalls, []);
});

test("POST rejects a header that does not match the cookie", async () => {
	const response = await POST(
		new Request("http://localhost/api/auth/register", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie: "csrf_token=cookie-token",
				"x-csrf-token": "header-token",
			},
			body: JSON.stringify(VALID_BODY),
		}),
	);

	assert.strictEqual(response.status, 401);
	assert.deepStrictEqual(createCalls, []);
});

test("POST accepts a matching cookie and header pair", async () => {
	// The counterweight to the three above: narrowing the exemption must reject
	// forgery without rejecting the legitimate page, which obtains its token
	// from GET /api/csrf and sends the pair.
	const response = await POST(registerRequest());

	assert.strictEqual(response.status, 201);
	assert.strictEqual(createCalls.length, 1);
});
