/**
 * @techstream/quark-core — Email Service
 *
 * Providers are defined using a Strategy Pattern — each implements the same
 * interface. Quark ships with three built-in providers (smtp, resend, zeptomail)
 * and exposes a registry so users can plug in any provider they need.
 *
 * @example Custom provider
 *   import { EmailProvider, registerEmailProvider } from "@techstream/quark-core";
 *
 *   class SendGridProvider extends EmailProvider {
 *     async sendEmail(to, subject, html, text) { ... }
 *   }
 *   registerEmailProvider("sendgrid", SendGridProvider);
 */

import { getDevMailConfig } from "./mail.js";

// ---------------------------------------------------------------------------
// Base class — extend this to add your own email provider
// ---------------------------------------------------------------------------

/**
 * Base email provider. All providers extend this class and implement sendEmail().
 */
export class EmailProvider {
	/**
	 * @param {string} from — Sender address (e.g. "App <noreply@example.com>")
	 */
	constructor(from) {
		this.from = from;
	}

	/**
	 * Validate that this provider is correctly configured.
	 * Called at service-creation time so failures are caught at startup, not on first send.
	 * Override in your provider to throw an Error if required env vars are missing.
	 */
	validateConfig() {}

	/**
	 * Send an email. Must be implemented by every provider subclass.
	 * Must return an object with at least `{ id: string }`.
	 *
	 * @param {string|string[]} to
	 * @param {string} subject
	 * @param {string} html
	 * @param {string} [text]
	 * @returns {Promise<{ id: string, [key: string]: any }>}
	 */
	// biome-ignore lint/correctness/noUnusedVariables: intentional provider interface
	async sendEmail(to, subject, html, text) {
		throw new Error(`${this.constructor.name} must implement sendEmail()`);
	}
}

// ---------------------------------------------------------------------------
// Built-in providers
// ---------------------------------------------------------------------------

class SmtpProvider extends EmailProvider {
	constructor(from) {
		super(from);
		this._transport = null;
	}

	async _getTransport() {
		if (this._transport) return this._transport;

		const nodemailer = await import("nodemailer");
		const host = process.env.SMTP_HOST;
		const port = process.env.SMTP_PORT;

		let config;
		if (host && port) {
			config = {
				host,
				port: parseInt(port, 10),
				secure: process.env.SMTP_SECURE === "true",
				connectionTimeout: 10_000,
				greetingTimeout: 10_000,
				socketTimeout: 10_000,
				...(process.env.SMTP_USER && {
					auth: {
						user: process.env.SMTP_USER,
						pass: process.env.SMTP_PASSWORD,
					},
				}),
			};
		} else {
			// Development: use local mail server (Mailpit)
			const mailConfig = getDevMailConfig();
			config = {
				host: mailConfig.host,
				port: mailConfig.port,
				secure: false,
				connectionTimeout: 10_000,
				greetingTimeout: 10_000,
				socketTimeout: 10_000,
			};
		}

		this._transport = nodemailer.default.createTransport(config);
		return this._transport;
	}

	async sendEmail(to, subject, html, text) {
		const transport = await this._getTransport();
		const result = await transport.sendMail({
			from: this.from,
			to: Array.isArray(to) ? to.join(", ") : to,
			subject,
			html,
			...(text && { text }),
		});
		return { id: result.messageId, ...result };
	}
}

class ResendProvider extends EmailProvider {
	validateConfig() {
		if (!process.env.RESEND_API_KEY) {
			throw new Error(
				"RESEND_API_KEY environment variable is required when EMAIL_PROVIDER=resend",
			);
		}
	}

	async sendEmail(to, subject, html, text) {
		const apiKey = process.env.RESEND_API_KEY;

		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: this.from,
				to: Array.isArray(to) ? to : [to],
				subject,
				html,
				...(text && { text }),
			}),
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ message: response.statusText }));
			throw new Error(
				`Resend API error: ${error.message || response.statusText}`,
			);
		}

		return response.json();
	}
}

/**
 * Parse "Name <address>" or plain "address" into Zeptomail's { name, address } format.
 * @param {string} emailStr
 * @returns {{ address: string, name?: string }}
 */
function _parseEmailAddress(emailStr) {
	const match = emailStr.match(/^(.+?)\s*<([^>]+)>$/);
	if (match) {
		return { name: match[1].trim(), address: match[2].trim() };
	}
	return { address: emailStr.trim() };
}

class ZeptomailProvider extends EmailProvider {
	validateConfig() {
		if (!process.env.ZEPTOMAIL_TOKEN) {
			throw new Error(
				"ZEPTOMAIL_TOKEN environment variable is required when EMAIL_PROVIDER=zeptomail",
			);
		}
		if (!process.env.ZEPTOMAIL_URL) {
			throw new Error(
				"ZEPTOMAIL_URL environment variable is required when EMAIL_PROVIDER=zeptomail",
			);
		}
	}

	async sendEmail(to, subject, html, text) {
		const apiKey = process.env.ZEPTOMAIL_TOKEN;
		const apiUrl = process.env.ZEPTOMAIL_URL;

		const response = await fetch(`${apiUrl}/v1.1/email`, {
			method: "POST",
			headers: {
				// Zeptomail tokens already include the "Zoho-enczapikey" scheme prefix
				Authorization: apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: _parseEmailAddress(this.from),
				to: Array.isArray(to)
					? to.map((email) => ({ email_address: { address: email } }))
					: [{ email_address: { address: to } }],
				subject,
				htmlbody: html,
				...(text && { textbody: text }),
				...(process.env.ZEPTOMAIL_BOUNCE_EMAIL && {
					bounce_address: process.env.ZEPTOMAIL_BOUNCE_EMAIL,
				}),
			}),
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ message: response.statusText }));
			throw new Error(
				`Zeptomail API error: ${error.message || response.statusText}`,
			);
		}

		// Normalize to { id } — Zeptomail returns { request_id }
		const data = await response.json();
		return { id: data.request_id ?? data.id, ...data };
	}
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

const _providers = {
	smtp: SmtpProvider,
	resend: ResendProvider,
	zeptomail: ZeptomailProvider,
};

/**
 * Register a custom email provider so it can be selected via EMAIL_PROVIDER.
 *
 * @param {string} name — value used in EMAIL_PROVIDER env var (e.g. "sendgrid")
 * @param {typeof EmailProvider} ProviderClass — must extend EmailProvider
 *
 * @example
 *   class SendGridProvider extends EmailProvider {
 *     async sendEmail(to, subject, html, text) { ... }
 *   }
 *   registerEmailProvider("sendgrid", SendGridProvider);
 */
export function registerEmailProvider(name, ProviderClass) {
	if (!(ProviderClass.prototype instanceof EmailProvider)) {
		throw new Error(
			`registerEmailProvider: ${ProviderClass.name} must extend EmailProvider`,
		);
	}
	_providers[name] = ProviderClass;
}

// ---------------------------------------------------------------------------
// Public API — unchanged for existing users
// ---------------------------------------------------------------------------

/**
 * Create an email service instance.
 *
 * @param {Object} [options]
 * @param {string} [options.provider] — Provider name: "smtp" (default), "resend",
 *   "zeptomail", or any name registered via registerEmailProvider()
 * @param {string} [options.from] — Sender address (defaults to EMAIL_FROM env var)
 * @returns {{ sendEmail: (to: string|string[], subject: string, html: string, text?: string) => Promise<Object> }}
 */
export function createEmailService(options = {}) {
	const providerName = options.provider || process.env.EMAIL_PROVIDER || "smtp";
	const from =
		options.from || process.env.EMAIL_FROM || "Quark <noreply@localhost>";

	const ProviderClass = _providers[providerName];
	if (!ProviderClass) {
		throw new Error(
			`Unknown email provider: "${providerName}". ` +
				`Built-in providers: ${Object.keys(_providers).join(", ")}. ` +
				`Use registerEmailProvider() to add custom providers.`,
		);
	}

	const provider = new ProviderClass(from);
	provider.validateConfig();

	return {
		/**
		 * Send an email via the configured provider.
		 *
		 * @param {string|string[]} to
		 * @param {string} subject
		 * @param {string} html — HTML body
		 * @param {string} [text] — Plain text body (optional)
		 * @returns {Promise<Object>}
		 */
		async sendEmail(to, subject, html, text) {
			// Input validation — common concern, applied before reaching any provider
			if (!to || (typeof to === "string" && !to.trim())) {
				throw new Error("Email 'to' address is required");
			}
			if (!subject || typeof subject !== "string" || !subject.trim()) {
				throw new Error("Email 'subject' is required");
			}
			if (!html || typeof html !== "string" || !html.trim()) {
				throw new Error("Email 'html' body is required");
			}

			return provider.sendEmail(to, subject, html, text);
		},
	};
}
