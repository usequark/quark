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

	// Mailhog
	MAILHOG_SMTP_URL: { required: false, description: "Mailhog SMTP URL" },
	MAILHOG_HOST: { required: false, description: "Mailhog host" },
	MAILHOG_SMTP_PORT: { required: false, description: "Mailhog SMTP port" },
	MAILHOG_UI_PORT: { required: false, description: "Mailhog UI port" },

	// NextAuth
	NEXTAUTH_SECRET: {
		required: true,
		description: "NextAuth secret for JWT signing",
	},
	NEXTAUTH_URL: { required: false, description: "NextAuth callback URL" },

	// Application
	NODE_ENV: {
		required: false,
		description: "Environment (development, test, production)",
	},
	WEB_PORT: { required: false, description: "Web server port" },
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

		if (value) {
			validated[key] = value;
		}
	}

	if (errors.length > 0) {
		const errorMessage = `Environment Validation Failed:\n${errors.join("\n")}`;
		throw new Error(errorMessage);
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
