/**
 * @usequark/quark-core - SMS Service
 *
 * Providers are defined using a Strategy Pattern - each implements the same
 * interface. Quark ships with one built-in provider (twilio) and exposes a
 * registry so users can plug in any provider they need.
 *
 * @example Custom provider
 *   import { SmsProvider, registerSmsProvider } from "@usequark/quark-core";
 *
 *   class AmazonSnsProvider extends SmsProvider {
 *     async sendSms(to, body) { ... }
 *   }
 *   registerSmsProvider("sns", AmazonSnsProvider);
 */

// ---------------------------------------------------------------------------
// Base class - extend this to add your own SMS provider
// ---------------------------------------------------------------------------

/**
 * Base SMS provider. All providers extend this class and implement sendSms().
 */
export class SmsProvider {
	/**
	 * @param {string} from - Sender phone number (e.g. "+6421XXXXXX")
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
	 * Send an SMS. Must be implemented by every provider subclass.
	 * Must return an object with at least `{ id: string }`.
	 *
	 * @param {string|string[]} to - recipient phone number(s)
	 * @param {string} body - message text (SMS body, typically 160 chars)
	 * @returns {Promise<{ id: string, [key: string]: any }>}
	 */
	async sendSms(_to, _body) {
		throw new Error(`${this.constructor.name} must implement sendSms()`);
	}
}

// ---------------------------------------------------------------------------
// Built-in providers
// ---------------------------------------------------------------------------

class TwilioProvider extends SmsProvider {
	_isDev() {
		return !process.env.NODE_ENV || process.env.NODE_ENV === "development";
	}

	validateConfig() {
		if (this._isDev()) {
			if (!process.env.TWILIO_TEST_ACCOUNT_SID) {
				throw new Error(
					"TWILIO_TEST_ACCOUNT_SID is required in development mode",
				);
			}
			if (!process.env.TWILIO_TEST_AUTH_TOKEN) {
				throw new Error(
					"TWILIO_TEST_AUTH_TOKEN is required in development mode",
				);
			}
		} else {
			if (!process.env.TWILIO_ACCOUNT_SID) {
				throw new Error(
					"TWILIO_ACCOUNT_SID environment variable is required when SMS_PROVIDER=twilio",
				);
			}
			if (!process.env.TWILIO_AUTH_TOKEN) {
				throw new Error(
					"TWILIO_AUTH_TOKEN environment variable is required when SMS_PROVIDER=twilio",
				);
			}
			if (!process.env.TWILIO_PHONE_NUMBER) {
				throw new Error(
					"TWILIO_PHONE_NUMBER environment variable is required when SMS_PROVIDER=twilio",
				);
			}
		}
	}

	async sendSms(to, body) {
		const isDev = this._isDev();
		const accountSid = isDev
			? process.env.TWILIO_TEST_ACCOUNT_SID
			: process.env.TWILIO_ACCOUNT_SID;
		const authToken = isDev
			? process.env.TWILIO_TEST_AUTH_TOKEN
			: process.env.TWILIO_AUTH_TOKEN;
		// In dev use Twilio sandbox magic number to simulate success without charges
		const from = isDev ? "+15005550006" : process.env.TWILIO_PHONE_NUMBER;

		const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
		const params = new URLSearchParams({
			To: Array.isArray(to) ? to.join(",") : to,
			From: from,
			Body: body,
		});

		const credentials = btoa(`${accountSid}:${authToken}`);
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Basic ${credentials}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: params.toString(),
			signal: AbortSignal.timeout(10_000),
		});

		const data = await response.json();

		if (!response.ok) {
			throw new Error(
				`Twilio API error: ${data.message || response.statusText}`,
			);
		}

		return { id: data.sid, ...data };
	}
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

const _providers = {
	twilio: TwilioProvider,
};

/**
 * Register a custom SMS provider so it can be selected via SMS_PROVIDER env var.
 *
 * @param {string} name - value used in SMS_PROVIDER env var (e.g. "sns")
 * @param {typeof SmsProvider} ProviderClass - must extend SmsProvider
 *
 * @example
 *   class AmazonSnsProvider extends SmsProvider {
 *     async sendSms(to, body) { ... }
 *   }
 *   registerSmsProvider("sns", AmazonSnsProvider);
 */
export function registerSmsProvider(name, ProviderClass) {
	if (!(ProviderClass.prototype instanceof SmsProvider)) {
		throw new Error(
			`registerSmsProvider: ${ProviderClass.name} must extend SmsProvider`,
		);
	}
	_providers[name] = ProviderClass;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an SMS service instance.
 *
 * @param {Object} [options]
 * @param {string} [options.provider] - Provider name: "twilio" (default), or any name
 *   registered via registerSmsProvider()
 * @returns {{ sendSms: (to: string|string[], body: string) => Promise<Object> }}
 */
export function createSmsService(options = {}) {
	const providerName = options.provider || process.env.SMS_PROVIDER || "twilio";

	const ProviderClass = _providers[providerName];
	if (!ProviderClass) {
		throw new Error(
			`Unknown SMS provider: "${providerName}". ` +
				`Built-in providers: ${Object.keys(_providers).join(", ")}. ` +
				`Use registerSmsProvider() to add custom providers.`,
		);
	}

	const provider = new ProviderClass();
	provider.validateConfig();

	return {
		/**
		 * Send an SMS via the configured provider.
		 *
		 * @param {string|string[]} to
		 * @param {string} body - SMS body text
		 * @returns {Promise<Object>}
		 */
		async sendSms(to, body) {
			if (!to || (typeof to === "string" && !to.trim())) {
				throw new Error("SMS 'to' address is required");
			}
			if (!body || typeof body !== "string" || !body.trim()) {
				throw new Error("SMS 'body' is required");
			}

			return provider.sendSms(to, body);
		},
	};
}
