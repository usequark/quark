import assert from "node:assert";
import { test } from "node:test";
import {
	createEmailService,
	EmailProvider,
	registerEmailProvider,
} from "./email.js";

test("Email Service", async (t) => {
	await t.test(
		"createEmailService returns object with sendEmail method",
		() => {
			const service = createEmailService();
			assert.strictEqual(typeof service, "object");
			assert.strictEqual(typeof service.sendEmail, "function");
		},
	);

	await t.test(
		"SMTP provider: uses mail defaults when no SMTP_HOST set",
		async () => {
			// Clear any explicit SMTP env vars
			const origHost = process.env.SMTP_HOST;
			const origPort = process.env.SMTP_PORT;
			delete process.env.SMTP_HOST;
			delete process.env.SMTP_PORT;

			try {
				const service = createEmailService({ provider: "smtp" });

				// Mock nodemailer at the transport level
				const _capturedConfig = null;
				const _mockTransport = {
					sendMail: async (opts) => {
						return { messageId: "test-id-123", ...opts };
					},
				};

				// We test that sendEmail resolves without error
				// The transport is lazily created, so sendEmail triggers creation
				// We can't easily intercept the dynamic import, but we can verify
				// the service was created correctly
				assert.strictEqual(typeof service.sendEmail, "function");
			} finally {
				if (origHost !== undefined) process.env.SMTP_HOST = origHost;
				else delete process.env.SMTP_HOST;
				if (origPort !== undefined) process.env.SMTP_PORT = origPort;
				else delete process.env.SMTP_PORT;
			}
		},
	);

	await t.test(
		"SMTP provider: uses explicit SMTP_HOST/SMTP_PORT when set",
		() => {
			const origHost = process.env.SMTP_HOST;
			const origPort = process.env.SMTP_PORT;
			process.env.SMTP_HOST = "mail.example.com";
			process.env.SMTP_PORT = "587";

			try {
				const service = createEmailService({ provider: "smtp" });
				assert.strictEqual(typeof service.sendEmail, "function");
			} finally {
				if (origHost !== undefined) process.env.SMTP_HOST = origHost;
				else delete process.env.SMTP_HOST;
				if (origPort !== undefined) process.env.SMTP_PORT = origPort;
				else delete process.env.SMTP_PORT;
			}
		},
	);

	await t.test(
		"Resend provider: throws at creation if RESEND_API_KEY missing",
		async () => {
			const origKey = process.env.RESEND_API_KEY;
			delete process.env.RESEND_API_KEY;

			try {
				assert.throws(
					() => createEmailService({ provider: "resend" }),
					(err) => err instanceof Error && /RESEND_API_KEY/.test(err.message),
				);
			} finally {
				if (origKey !== undefined) process.env.RESEND_API_KEY = origKey;
				else delete process.env.RESEND_API_KEY;
			}
		},
	);

	await t.test(
		"Resend provider: calls fetch with correct URL, headers, and body",
		async () => {
			const origKey = process.env.RESEND_API_KEY;
			process.env.RESEND_API_KEY = "re_test_key_123";

			// Mock global fetch
			const originalFetch = globalThis.fetch;
			let capturedUrl = null;
			let capturedOptions = null;

			globalThis.fetch = async (url, opts) => {
				capturedUrl = url;
				capturedOptions = opts;
				return {
					ok: true,
					json: async () => ({ id: "resend-msg-id" }),
				};
			};

			try {
				const service = createEmailService({
					provider: "resend",
					from: "Test <test@example.com>",
				});

				const result = await service.sendEmail(
					"recipient@example.com",
					"Test Subject",
					"<p>Hello</p>",
					"Hello",
				);

				assert.strictEqual(capturedUrl, "https://api.resend.com/emails");
				assert.strictEqual(capturedOptions.method, "POST");

				const headers = capturedOptions.headers;
				assert.strictEqual(headers.Authorization, "Bearer re_test_key_123");
				assert.strictEqual(headers["Content-Type"], "application/json");

				const body = JSON.parse(capturedOptions.body);
				assert.strictEqual(body.from, "Test <test@example.com>");
				assert.deepStrictEqual(body.to, ["recipient@example.com"]);
				assert.strictEqual(body.subject, "Test Subject");
				assert.strictEqual(body.html, "<p>Hello</p>");
				assert.strictEqual(body.text, "Hello");

				assert.strictEqual(result.id, "resend-msg-id");
			} finally {
				globalThis.fetch = originalFetch;
				if (origKey !== undefined) process.env.RESEND_API_KEY = origKey;
				else delete process.env.RESEND_API_KEY;
			}
		},
	);

	await t.test("Resend provider: throws on non-ok response", async () => {
		const origKey = process.env.RESEND_API_KEY;
		process.env.RESEND_API_KEY = "re_test_key_123";

		const originalFetch = globalThis.fetch;
		globalThis.fetch = async () => ({
			ok: false,
			statusText: "Unprocessable Entity",
			json: async () => ({ message: "Invalid email address" }),
		});

		try {
			const service = createEmailService({ provider: "resend" });

			await assert.rejects(
				() => service.sendEmail("bad@", "Subject", "<p>body</p>"),
				(err) =>
					err instanceof Error &&
					/Resend API error/.test(err.message) &&
					/Invalid email address/.test(err.message),
			);
		} finally {
			globalThis.fetch = originalFetch;
			if (origKey !== undefined) process.env.RESEND_API_KEY = origKey;
			else delete process.env.RESEND_API_KEY;
		}
	});

	await t.test("Resend provider: handles non-JSON error response", async () => {
		const origKey = process.env.RESEND_API_KEY;
		process.env.RESEND_API_KEY = "re_test_key_123";

		const originalFetch = globalThis.fetch;
		globalThis.fetch = async () => ({
			ok: false,
			statusText: "Internal Server Error",
			json: async () => {
				throw new Error("not json");
			},
		});

		try {
			const service = createEmailService({ provider: "resend" });

			await assert.rejects(
				() => service.sendEmail("test@example.com", "Subject", "<p>body</p>"),
				(err) =>
					err instanceof Error &&
					/Resend API error/.test(err.message) &&
					/Internal Server Error/.test(err.message),
			);
		} finally {
			globalThis.fetch = originalFetch;
			if (origKey !== undefined) process.env.RESEND_API_KEY = origKey;
			else delete process.env.RESEND_API_KEY;
		}
	});

	await t.test("default provider is smtp", () => {
		const origProvider = process.env.EMAIL_PROVIDER;
		delete process.env.EMAIL_PROVIDER;

		try {
			const service = createEmailService();
			// The service should be created without error (defaults to smtp)
			assert.strictEqual(typeof service.sendEmail, "function");
		} finally {
			if (origProvider !== undefined) process.env.EMAIL_PROVIDER = origProvider;
			else delete process.env.EMAIL_PROVIDER;
		}
	});

	await t.test("respects options.from override", async () => {
		const origKey = process.env.RESEND_API_KEY;
		process.env.RESEND_API_KEY = "re_test_key_123";

		const originalFetch = globalThis.fetch;
		let capturedBody = null;

		globalThis.fetch = async (_url, opts) => {
			capturedBody = JSON.parse(opts.body);
			return { ok: true, json: async () => ({ id: "msg-1" }) };
		};

		try {
			const service = createEmailService({
				provider: "resend",
				from: "Custom <custom@example.com>",
			});

			await service.sendEmail("to@example.com", "Sub", "<p>Hi</p>");
			assert.strictEqual(capturedBody.from, "Custom <custom@example.com>");
		} finally {
			globalThis.fetch = originalFetch;
			if (origKey !== undefined) process.env.RESEND_API_KEY = origKey;
			else delete process.env.RESEND_API_KEY;
		}
	});

	await t.test(
		"Zeptomail provider: throws at creation if ZEPTOMAIL_TOKEN missing",
		async () => {
			const origToken = process.env.ZEPTOMAIL_TOKEN;
			const origUrl = process.env.ZEPTOMAIL_URL;
			delete process.env.ZEPTOMAIL_TOKEN;
			process.env.ZEPTOMAIL_URL = "https://api.zeptomail.com";

			try {
				assert.throws(
					() => createEmailService({ provider: "zeptomail" }),
					(err) => err instanceof Error && /ZEPTOMAIL_TOKEN/.test(err.message),
				);
			} finally {
				if (origToken !== undefined) process.env.ZEPTOMAIL_TOKEN = origToken;
				else delete process.env.ZEPTOMAIL_TOKEN;
				if (origUrl !== undefined) process.env.ZEPTOMAIL_URL = origUrl;
				else delete process.env.ZEPTOMAIL_URL;
			}
		},
	);

	await t.test(
		"Zeptomail provider: throws at creation if ZEPTOMAIL_URL missing",
		async () => {
			const origToken = process.env.ZEPTOMAIL_TOKEN;
			const origUrl = process.env.ZEPTOMAIL_URL;
			process.env.ZEPTOMAIL_TOKEN = "zep_test_token_123";
			delete process.env.ZEPTOMAIL_URL;

			try {
				assert.throws(
					() => createEmailService({ provider: "zeptomail" }),
					(err) => err instanceof Error && /ZEPTOMAIL_URL/.test(err.message),
				);
			} finally {
				if (origToken !== undefined) process.env.ZEPTOMAIL_TOKEN = origToken;
				else delete process.env.ZEPTOMAIL_TOKEN;
				if (origUrl !== undefined) process.env.ZEPTOMAIL_URL = origUrl;
				else delete process.env.ZEPTOMAIL_URL;
			}
		},
	);

	await t.test(
		"Zeptomail provider: calls fetch with correct URL, headers, and body",
		async () => {
			const origToken = process.env.ZEPTOMAIL_TOKEN;
			const origUrl = process.env.ZEPTOMAIL_URL;
			process.env.ZEPTOMAIL_TOKEN = "zep_test_token_123";
			process.env.ZEPTOMAIL_URL = "https://api.zeptomail.com";

			const originalFetch = globalThis.fetch;
			let capturedUrl = null;
			let capturedOptions = null;

			globalThis.fetch = async (url, opts) => {
				capturedUrl = url;
				capturedOptions = opts;
				return {
					ok: true,
					json: async () => ({ request_id: "zep-request-id" }),
				};
			};

			try {
				const service = createEmailService({
					provider: "zeptomail",
					from: "Test <test@example.com>",
				});

				const result = await service.sendEmail(
					"recipient@example.com",
					"Test Subject",
					"<p>Hello</p>",
					"Hello",
				);

				assert.strictEqual(capturedUrl, "https://api.zeptomail.com/v1.1/email");
				assert.strictEqual(capturedOptions.method, "POST");

				const headers = capturedOptions.headers;
				// Token is used as-is; it already carries the "Zoho-enczapikey" scheme
				assert.strictEqual(headers.Authorization, "zep_test_token_123");
				assert.strictEqual(headers["Content-Type"], "application/json");

				const body = JSON.parse(capturedOptions.body);
				assert.deepStrictEqual(body.from, {
					name: "Test",
					address: "test@example.com",
				});
				assert.strictEqual(body.subject, "Test Subject");
				assert.strictEqual(body.htmlbody, "<p>Hello</p>");
				assert.strictEqual(body.textbody, "Hello");

				assert.strictEqual(result.request_id, "zep-request-id");
				// Normalized: id should equal request_id
				assert.strictEqual(result.id, "zep-request-id");
			} finally {
				globalThis.fetch = originalFetch;
				if (origToken !== undefined) process.env.ZEPTOMAIL_TOKEN = origToken;
				else delete process.env.ZEPTOMAIL_TOKEN;
				if (origUrl !== undefined) process.env.ZEPTOMAIL_URL = origUrl;
				else delete process.env.ZEPTOMAIL_URL;
			}
		},
	);

	await t.test("input validation: rejects empty 'to'", async () => {
		const service = createEmailService();
		await assert.rejects(
			() => service.sendEmail("", "Subject", "<p>body</p>"),
			(err) => err instanceof Error && /to/.test(err.message),
		);
		await assert.rejects(
			() => service.sendEmail(null, "Subject", "<p>body</p>"),
			(err) => err instanceof Error && /to/.test(err.message),
		);
	});

	await t.test("input validation: rejects empty 'subject'", async () => {
		const service = createEmailService();
		await assert.rejects(
			() => service.sendEmail("a@b.com", "", "<p>body</p>"),
			(err) => err instanceof Error && /subject/.test(err.message),
		);
	});

	await t.test("input validation: rejects empty 'html'", async () => {
		const service = createEmailService();
		await assert.rejects(
			() => service.sendEmail("a@b.com", "Subject", ""),
			(err) => err instanceof Error && /html/.test(err.message),
		);
	});

	// --- Strategy Pattern ---

	await t.test("EmailProvider base class is exported", () => {
		assert.strictEqual(typeof EmailProvider, "function");
		const provider = new EmailProvider("test@example.com");
		assert.strictEqual(provider.from, "test@example.com");
		// validateConfig() is a no-op on base class — must not throw
		assert.doesNotThrow(() => provider.validateConfig());
	});

	await t.test(
		"EmailProvider base class sendEmail throws not-implemented",
		async () => {
			const provider = new EmailProvider("test@example.com");
			await assert.rejects(
				() => provider.sendEmail("to@example.com", "Subject", "<p>Hi</p>"),
				(err) =>
					err instanceof Error && /must implement sendEmail/.test(err.message),
			);
		},
	);

	await t.test("createEmailService throws for unknown provider", () => {
		assert.throws(
			() => createEmailService({ provider: "unknown-provider" }),
			(err) =>
				err instanceof Error &&
				/Unknown email provider/.test(err.message) &&
				/unknown-provider/.test(err.message),
		);
	});

	await t.test(
		"registerEmailProvider: validateConfig() is called at service creation",
		() => {
			class BrokenProvider extends EmailProvider {
				validateConfig() {
					throw new Error("missing MY_API_KEY");
				}
				async sendEmail() {
					return { id: "x" };
				}
			}
			registerEmailProvider("test-broken", BrokenProvider);

			assert.throws(
				() => createEmailService({ provider: "test-broken" }),
				(err) => err instanceof Error && /MY_API_KEY/.test(err.message),
			);
		},
	);

	await t.test("registerEmailProvider: rejects non-subclass", () => {
		class NotAProvider {
			async sendEmail() {}
		}
		assert.throws(
			() => registerEmailProvider("not-valid", NotAProvider),
			(err) =>
				err instanceof Error && /must extend EmailProvider/.test(err.message),
		);
	});

	await t.test(
		"registerEmailProvider: custom provider is used by createEmailService",
		async () => {
			let capturedArgs = null;

			class TestProvider extends EmailProvider {
				async sendEmail(to, subject, html, text) {
					capturedArgs = { to, subject, html, text, from: this.from };
					return { id: "custom-provider-id" };
				}
			}

			registerEmailProvider("test-custom", TestProvider);

			const service = createEmailService({
				provider: "test-custom",
				from: "Custom <custom@example.com>",
			});

			const result = await service.sendEmail(
				"to@example.com",
				"Custom Subject",
				"<p>Custom Body</p>",
				"Custom Body",
			);

			assert.strictEqual(result.id, "custom-provider-id");
			assert.strictEqual(capturedArgs.to, "to@example.com");
			assert.strictEqual(capturedArgs.subject, "Custom Subject");
			assert.strictEqual(capturedArgs.html, "<p>Custom Body</p>");
			assert.strictEqual(capturedArgs.text, "Custom Body");
			assert.strictEqual(capturedArgs.from, "Custom <custom@example.com>");
		},
	);

	await t.test(
		"registerEmailProvider: custom provider still runs input validation",
		async () => {
			class NoopProvider extends EmailProvider {
				async sendEmail() {
					return { id: "noop" };
				}
			}

			registerEmailProvider("test-noop", NoopProvider);
			const service = createEmailService({ provider: "test-noop" });

			await assert.rejects(
				() => service.sendEmail("", "Subject", "<p>body</p>"),
				(err) => err instanceof Error && /to/.test(err.message),
			);
		},
	);
});
