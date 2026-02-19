/**
 * @techstream/quark-core - Email Service
 * Supports SMTP (Nodemailer) and Resend providers
 */

import { getDevMailConfig } from "./mail.js";

/**
 * Create an SMTP-based email sender using Nodemailer
 */
async function createSmtpTransport() {
	const nodemailer = await import("nodemailer");

	// Use explicit SMTP config if provided, otherwise fall back to local mail server
	const host = process.env.SMTP_HOST;
	const port = process.env.SMTP_PORT;

	let transportConfig;

	if (host && port) {
		// Production SMTP configuration
		transportConfig = {
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
		transportConfig = {
			host: mailConfig.host,
			port: mailConfig.port,
			secure: false,
			connectionTimeout: 10_000,
			greetingTimeout: 10_000,
			socketTimeout: 10_000,
		};
	}

	return nodemailer.default.createTransport(transportConfig);
}

/**
 * Send email via Resend HTTP API
 */
async function sendViaResend(from, to, subject, html, text) {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		throw new Error(
			"RESEND_API_KEY environment variable is required when EMAIL_PROVIDER=resend",
		);
	}

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from,
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

/**
 * Create an email service instance
 *
 * @param {Object} [options]
 * @param {string} [options.provider] - "smtp" or "resend" (defaults to EMAIL_PROVIDER env var or "smtp")
 * @param {string} [options.from] - Sender address (defaults to EMAIL_FROM env var)
 * @returns {{ sendEmail: (to: string|string[], subject: string, html: string, text?: string) => Promise<Object> }}
 */
export function createEmailService(options = {}) {
	const provider = options.provider || process.env.EMAIL_PROVIDER || "smtp";
	const from =
		options.from || process.env.EMAIL_FROM || "Quark <noreply@localhost>";

	let smtpTransport = null;

	return {
		/**
		 * Send an email
		 * @param {string|string[]} to - Recipient email(s)
		 * @param {string} subject - Email subject
		 * @param {string} html - HTML body
		 * @param {string} [text] - Plain text body (optional)
		 * @returns {Promise<Object>} Send result
		 */
		async sendEmail(to, subject, html, text) {
			// Input validation
			if (!to || (typeof to === "string" && !to.trim())) {
				throw new Error("Email 'to' address is required");
			}
			if (!subject || typeof subject !== "string" || !subject.trim()) {
				throw new Error("Email 'subject' is required");
			}
			if (!html || typeof html !== "string" || !html.trim()) {
				throw new Error("Email 'html' body is required");
			}

			if (provider === "resend") {
				return sendViaResend(from, to, subject, html, text);
			}

			// SMTP (Nodemailer) — default
			if (!smtpTransport) {
				smtpTransport = await createSmtpTransport();
			}

			const result = await smtpTransport.sendMail({
				from,
				to: Array.isArray(to) ? to.join(", ") : to,
				subject,
				html,
				...(text && { text }),
			});

			return { id: result.messageId, ...result };
		},
	};
}
