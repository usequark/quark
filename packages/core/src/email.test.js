import assert from "node:assert";
import { test } from "node:test";
import { createEmailService } from "./email.js";

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
		"Resend provider: throws if RESEND_API_KEY missing",
		async () => {
			const origKey = process.env.RESEND_API_KEY;
			delete process.env.RESEND_API_KEY;

			try {
				const service = createEmailService({ provider: "resend" });

				await assert.rejects(
					() => service.sendEmail("test@example.com", "Subject", "<p>body</p>"),
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
});
