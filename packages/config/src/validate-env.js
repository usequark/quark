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

	// Mail (local SMTP server)
	MAIL_SMTP_URL: { required: false, description: "Mail SMTP URL" },
	MAIL_HOST: { required: false, description: "Mail host" },
	MAIL_SMTP_PORT: { required: false, description: "Mail SMTP port" },
	MAIL_UI_PORT: { required: false, description: "Mail UI port" },

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
		description: "Environment (development, test, production)",
	},
	PORT: { required: false, description: "Web server port" },
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
