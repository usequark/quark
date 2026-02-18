import { syncNextAuthUrl } from "./app-url.js";

/**
 * Environment variable validation schema
 * Validates all required and optional environment variables on startup
 */

const envSchema = {
	// Database
	DATABASE_URL: {
		required: false,
		description: "PostgreSQL connection string",
	},
	POSTGRES_HOST: { required: false, description: "PostgreSQL host" },
	POSTGRES_PORT: { required: false, description: "PostgreSQL port" },
	POSTGRES_USER: { required: false, description: "PostgreSQL user" },
	POSTGRES_PASSWORD: { required: false, description: "PostgreSQL password" },
	POSTGRES_DB: { required: false, description: "PostgreSQL database name" },

	// Redis
	REDIS_URL: { required: false, description: "Redis connection string" },
	REDIS_HOST: { required: false, description: "Redis host" },
	REDIS_PORT: { required: false, description: "Redis port" },

	// Mail (local SMTP — Mailpit in dev)
	MAIL_SMTP_URL: { required: false, description: "Mail SMTP URL" },
	MAIL_HOST: { required: false, description: "Mail host" },
	MAIL_SMTP_PORT: { required: false, description: "Mail SMTP port" },
	MAIL_UI_PORT: { required: false, description: "Mail UI port" },

	// Production SMTP (used when SMTP_HOST is set)
	SMTP_HOST: { required: false, description: "Production SMTP host" },
	SMTP_PORT: { required: false, description: "Production SMTP port" },
	SMTP_SECURE: { required: false, description: "Use TLS for SMTP" },
	SMTP_USER: { required: false, description: "SMTP username" },
	SMTP_PASSWORD: { required: false, description: "SMTP password" },

	// Email provider
	EMAIL_PROVIDER: {
		required: false,
		description: 'Email provider — "smtp" (default) or "resend"',
	},
	EMAIL_FROM: { required: false, description: "Sender email address" },
	RESEND_API_KEY: { required: false, description: "Resend API key" },

	// NextAuth
	NEXTAUTH_SECRET: {
		required: true,
		description: "NextAuth secret for JWT signing",
		minLength: 32,
	},
	NEXTAUTH_URL: {
		required: false,
		description: "NextAuth callback URL (derived from APP_URL if not set)",
	},

	// Application
	APP_URL: {
		required: false,
		description:
			"Canonical application URL — derives NEXTAUTH_URL and CORS origins",
	},
	NODE_ENV: {
		required: false,
		description: "Environment (development, test, staging, production)",
	},
	PORT: { required: false, description: "Web server port" },

	// Storage
	STORAGE_PROVIDER: {
		required: false,
		description: 'Storage provider — "local" (default) or "s3"',
	},
	STORAGE_LOCAL_DIR: {
		required: false,
		description: "Local storage directory",
	},
	S3_BUCKET: { required: false, description: "S3 bucket name" },
	S3_REGION: { required: false, description: "S3 region" },
	S3_ENDPOINT: { required: false, description: "S3-compatible endpoint URL" },
	S3_ACCESS_KEY_ID: { required: false, description: "S3 access key" },
	S3_SECRET_ACCESS_KEY: { required: false, description: "S3 secret key" },
	S3_PUBLIC_URL: { required: false, description: "S3 public URL prefix" },
};

/**
 * Validates environment variables against schema
 * @throws {Error} If required environment variables are missing
 * @returns {Object} Validated environment object
 */
export function validateEnv() {
	const errors = [];
	const validated = {};

	for (const [key, config] of Object.entries(envSchema)) {
		const value = process.env[key];

		if (config.required && !value) {
			errors.push(
				`Missing required environment variable: ${key} (${config.description})`,
			);
		}

		if (value && config.minLength && value.length < config.minLength) {
			errors.push(
				`${key} must be at least ${config.minLength} characters (${config.description})`,
			);
		}

		if (value) {
			validated[key] = value;
		}
	}

	// Conditional: S3 storage requires bucket + credentials
	if (process.env.STORAGE_PROVIDER === "s3") {
		for (const key of [
			"S3_BUCKET",
			"S3_ACCESS_KEY_ID",
			"S3_SECRET_ACCESS_KEY",
		]) {
			if (!process.env[key]) {
				errors.push(
					`Missing ${key} — required when STORAGE_PROVIDER=s3 (${envSchema[key].description})`,
				);
			}
		}
	}

	// Conditional: Resend provider requires API key
	if (process.env.EMAIL_PROVIDER === "resend" && !process.env.RESEND_API_KEY) {
		errors.push("Missing RESEND_API_KEY — required when EMAIL_PROVIDER=resend");
	}

	if (errors.length > 0) {
		const errorMessage = `Environment Validation Failed:\n${errors.join("\n")}`;
		throw new Error(errorMessage);
	}

	// Ensure NEXTAUTH_URL is derived from APP_URL when not explicitly set
	syncNextAuthUrl();

	// Include the (possibly derived) NEXTAUTH_URL in the validated object
	if (process.env.NEXTAUTH_URL && !validated.NEXTAUTH_URL) {
		validated.NEXTAUTH_URL = process.env.NEXTAUTH_URL;
	}

	return validated;
}

/**
 * Loads and validates environment variables
 * Call this function at application startup
 */
export function loadEnv() {
	try {
		return validateEnv();
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
