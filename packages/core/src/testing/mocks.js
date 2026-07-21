/**
 * Reusable mock objects for testing without external services.
 * All mocks use plain JavaScript objects and closures - no complex proxy chains.
 *
 * @module testing/mocks
 */

/**
 * @typedef {Object} MockCall
 * @property {string} model - The model name (e.g. "user", "post")
 * @property {string} method - The method name (e.g. "findUnique", "create")
 * @property {Array<*>} args - Arguments passed to the method
 */

/**
 * @typedef {Object} MockPrisma
 * @property {MockCall[]} calls - Recorded method calls
 * @property {() => void} reset - Clear all recorded calls
 * @property {(model: string, method: string, value: *) => void} mockReturn - Set return value for model.method
 */

/**
 * Create a mock Prisma client that records all calls and returns configurable results.
 *
 * Supports any model/method combination. Unknown models and methods return `null` by default.
 * Use `.mockReturn(model, method, value)` to configure return values.
 * Use `.calls` to inspect recorded calls.
 * Use `.reset()` to clear recorded calls and return values.
 *
 * @param {Record<string, Record<string, *>>} [overrides={}] - Initial return values keyed by model.method
 * @returns {MockPrisma & Record<string, Record<string, Function>>}
 *
 * @example
 * const prisma = createMockPrisma();
 * prisma.mockReturn("user", "findUnique", { id: "1", name: "Test" });
 * const user = await prisma.user.findUnique({ where: { id: "1" } });
 * // user => { id: "1", name: "Test" }
 * // prisma.calls => [{ model: "user", method: "findUnique", args: [{ where: { id: "1" } }] }]
 */
export function createMockPrisma(overrides = {}) {
	/** @type {MockCall[]} */
	const calls = [];

	/** @type {Record<string, Record<string, *>>} */
	const returnValues = {};

	// Initialize with overrides
	for (const [model, methods] of Object.entries(overrides)) {
		returnValues[model] = { ...methods };
	}

	/**
	 * Set a return value for a specific model.method combination.
	 * The value can be a plain value or a function that receives the call args.
	 * @param {string} model
	 * @param {string} method
	 * @param {*} value
	 */
	function mockReturn(model, method, value) {
		if (!returnValues[model]) {
			returnValues[model] = {};
		}
		returnValues[model][method] = value;
	}

	/** Clear all recorded calls and return values. */
	function reset() {
		calls.length = 0;
		for (const key of Object.keys(returnValues)) {
			delete returnValues[key];
		}
	}

	/** @type {Record<string, Record<string, Function>>} */
	const modelCache = {};

	/**
	 * Get or create a model accessor with method recording.
	 * @param {string} model
	 * @returns {Record<string, Function>}
	 */
	function getModel(model) {
		if (!modelCache[model]) {
			modelCache[model] = new Proxy(
				{},
				{
					get(_target, method) {
						if (typeof method !== "string") return undefined;
						return async (...args) => {
							calls.push({ model, method, args });
							const modelReturns = returnValues[model];
							if (modelReturns && method in modelReturns) {
								const val = modelReturns[method];
								return typeof val === "function" ? val(...args) : val;
							}
							return null;
						};
					},
				},
			);
		}
		return modelCache[model];
	}

	return new Proxy(
		/** @type {any} */ ({
			calls,
			reset,
			mockReturn,
		}),
		{
			get(target, prop) {
				if (prop === "calls" || prop === "reset" || prop === "mockReturn") {
					return target[prop];
				}
				if (typeof prop === "string") {
					return getModel(prop);
				}
				return undefined;
			},
		},
	);
}

/**
 * @typedef {Object} MockRequestOptions
 * @property {string} [method="GET"] - HTTP method
 * @property {string} [url="http://localhost/api/test"] - Request URL
 * @property {Record<string, string>} [headers={}] - Headers (lowercase keys)
 * @property {*} [body=null] - Request body
 * @property {Record<string, string>} [cookies={}] - Cookie key-value pairs
 */

/**
 * Create a mock Request object compatible with Next.js API routes and middleware.
 *
 * @param {MockRequestOptions} [overrides={}]
 * @returns {Object} A mock request with method, url, headers, body, cookies, and nextUrl
 *
 * @example
 * const req = createMockRequest({
 *   method: "POST",
 *   headers: { "content-type": "application/json" },
 *   body: { name: "Test" },
 * });
 */
export function createMockRequest(overrides = {}) {
	const method = overrides.method || "GET";
	const url = overrides.url || "http://localhost/api/test";
	const parsedUrl = new URL(url);
	const headerMap = new Map(
		Object.entries(overrides.headers || {}).map(([k, v]) => [
			k.toLowerCase(),
			v,
		]),
	);
	const cookieMap = new Map(Object.entries(overrides.cookies || {}));
	const body = overrides.body ?? null;

	return {
		method,
		url,
		nextUrl: parsedUrl,
		headers: {
			/** @param {string} key */
			get(key) {
				return headerMap.get(key.toLowerCase()) ?? null;
			},
			/** @param {string} key */
			has(key) {
				return headerMap.has(key.toLowerCase());
			},
			/** @param {string} key @param {string} value */
			set(key, value) {
				headerMap.set(key.toLowerCase(), value);
			},
			/** Iterate over all headers */
			entries() {
				return headerMap.entries();
			},
			forEach(fn) {
				headerMap.forEach((value, key) => {
					fn(value, key);
				});
			},
		},
		cookies: {
			/** @param {string} name */
			get(name) {
				const value = cookieMap.get(name);
				return value !== undefined ? { name, value } : undefined;
			},
			/** @param {string} name */
			has(name) {
				return cookieMap.has(name);
			},
			getAll() {
				return [...cookieMap.entries()].map(([name, value]) => ({
					name,
					value,
				}));
			},
		},
		async json() {
			return body;
		},
		async text() {
			return typeof body === "string" ? body : JSON.stringify(body);
		},
	};
}

/**
 * @typedef {Object} MockResponse
 * @property {number} status - HTTP status code
 * @property {Map<string, string>} headers - Response headers
 * @property {*} body - Response body (set via json())
 * @property {Map<string, string>} cookies - Response cookies
 * @property {(data: *) => MockResponse} json - Set JSON body and return self
 * @property {(url: string) => MockResponse} redirect - Create a redirect response
 */

/**
 * Create a mock NextResponse object for testing middleware.
 *
 * @returns {MockResponse}
 *
 * @example
 * const res = createMockResponse();
 * res.json({ ok: true });
 * assert.deepStrictEqual(res.body, { ok: true });
 */
export function createMockResponse() {
	const headers = new Map();
	const cookies = new Map();

	const response = {
		status: 200,
		headers: {
			/** @param {string} key */
			get(key) {
				return headers.get(key.toLowerCase()) ?? null;
			},
			/** @param {string} key @param {string} value */
			set(key, value) {
				headers.set(key.toLowerCase(), value);
			},
			/** @param {string} key */
			has(key) {
				return headers.has(key.toLowerCase());
			},
			entries() {
				return headers.entries();
			},
		},
		body: null,
		cookies: {
			/** @param {string} name @param {string} value */
			set(name, value) {
				cookies.set(name, value);
			},
			/** @param {string} name */
			get(name) {
				return cookies.get(name) ?? null;
			},
			/** @param {string} name */
			has(name) {
				return cookies.has(name);
			},
			/** @param {string} name */
			delete(name) {
				cookies.delete(name);
			},
		},
		/**
		 * Set JSON body and content-type header.
		 * @param {*} data
		 * @returns {MockResponse}
		 */
		json(data) {
			response.body = data;
			headers.set("content-type", "application/json");
			return response;
		},
		/**
		 * Create a redirect-like response.
		 * @param {string} url
		 * @returns {MockResponse}
		 */
		redirect(url) {
			response.status = 302;
			headers.set("location", url);
			return response;
		},
	};

	return response;
}

/**
 * @typedef {Object} MockRedis
 * @property {Array<{method: string, args: Array<*>}>} calls - Recorded method calls
 * @property {() => void} reset - Clear all stored data and recorded calls
 */

/**
 * Create a mock Redis client backed by an in-memory Map.
 * Records all method calls for assertion. Supports common Redis commands:
 * get, set, del, keys, expire, exists, incr, pipeline, ping, quit, disconnect.
 *
 * @param {Record<string, string>} [initialData={}] - Pre-populate the store
 * @returns {MockRedis & Record<string, Function>}
 *
 * @example
 * const redis = createMockRedis({ "session:1": '{"user":"alice"}' });
 * await redis.set("key", "value");
 * const val = await redis.get("key");
 * // val => "value"
 * // redis.calls => [{ method: "set", args: ["key", "value"] }, { method: "get", args: ["key"] }]
 */
export function createMockRedis(initialData = {}) {
	/** @type {Map<string, string>} */
	const store = new Map(Object.entries(initialData));
	/** @type {Map<string, number>} */
	const ttls = new Map();
	/** @type {Array<{method: string, args: Array<*>}>} */
	const calls = [];

	/**
	 * Record a method call.
	 * @param {string} method
	 * @param {Array<*>} args
	 */
	function record(method, args) {
		calls.push({ method, args: [...args] });
	}

	/** Clear all stored data and recorded calls. */
	function reset() {
		store.clear();
		ttls.clear();
		calls.length = 0;
	}

	return {
		calls,
		reset,

		/** @param {string} key */
		async get(key) {
			record("get", [key]);
			return store.get(key) ?? null;
		},

		/**
		 * @param {string} key
		 * @param {string} value
		 * @param  {...*} args - Optional args like "EX", seconds
		 */
		async set(key, value, ...args) {
			record("set", [key, value, ...args]);
			store.set(key, value);
			// Handle EX/PX TTL args
			const exIdx = args.indexOf("EX");
			if (exIdx !== -1 && args[exIdx + 1] !== undefined) {
				ttls.set(key, Number(args[exIdx + 1]));
			}
			return "OK";
		},

		/** @param {...string} keys */
		async del(...keys) {
			record("del", keys);
			let count = 0;
			for (const key of keys) {
				if (store.delete(key)) count++;
				ttls.delete(key);
			}
			return count;
		},

		/** @param {string} pattern */
		async keys(pattern) {
			record("keys", [pattern]);
			// Simple glob: only supports trailing *
			const prefix = pattern.replace(/\*$/, "");
			return [...store.keys()].filter((k) => k.startsWith(prefix));
		},

		/**
		 * @param {string} key
		 * @param {number} seconds
		 */
		async expire(key, seconds) {
			record("expire", [key, seconds]);
			if (store.has(key)) {
				ttls.set(key, seconds);
				return 1;
			}
			return 0;
		},

		/** @param {...string} keys */
		async exists(...keys) {
			record("exists", keys);
			return keys.filter((k) => store.has(k)).length;
		},

		/** @param {string} key */
		async incr(key) {
			record("incr", [key]);
			const current = Number.parseInt(store.get(key) || "0", 10);
			const next = current + 1;
			store.set(key, String(next));
			return next;
		},

		/**
		 * Create a pipeline that batches commands and executes them together.
		 * @returns {Object} A chainable pipeline with .exec()
		 */
		pipeline() {
			record("pipeline", []);
			/** @type {Array<() => Promise<*>>} */
			const queue = [];

			const pipe = {
				/** @param {string} key */
				get(key) {
					queue.push(async () => store.get(key) ?? null);
					return pipe;
				},
				/** @param {string} key @param {string} value */
				set(key, value) {
					queue.push(async () => {
						store.set(key, value);
						return "OK";
					});
					return pipe;
				},
				/** @param {...string} keys */
				del(...keys) {
					queue.push(async () => {
						let count = 0;
						for (const k of keys) {
							if (store.delete(k)) count++;
						}
						return count;
					});
					return pipe;
				},
				/** Execute all queued commands and return results. */
				async exec() {
					const results = [];
					for (const fn of queue) {
						results.push([null, await fn()]);
					}
					return results;
				},
			};

			return pipe;
		},

		async ping() {
			record("ping", []);
			return "PONG";
		},

		async quit() {
			record("quit", []);
			return "OK";
		},

		async disconnect() {
			record("disconnect", []);
			return "OK";
		},
	};
}
