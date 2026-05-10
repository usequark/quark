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
		description: 'Email provider — "smtp" (default), "resend", or "zeptomail"',
	},
	EMAIL_FROM: { required: false, description: "Sender email address" },
	RESEND_API_KEY: { required: false, description: "Resend API key" },
	ZEPTOMAIL_TOKEN: { required: false, description: "Zeptomail API token" },
	ZEPTOMAIL_URL: { required: false, description: "Zeptomail API base URL" },
	ZEPTOMAIL_BOUNCE_EMAIL: {
		required: false,
		description: "Zeptomail bounce email address",
	},

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
	APP_NAME: {
		required: false,
		description: "Application name — used in metadata, emails, and page titles",
	},
	APP_DESCRIPTION: {
		required: false,
		description:
			"Application description — used for SEO metadata and social previews",
	},
	APP_URL: {
		required: false,
		description:
			"Canonical application URL — derives NEXTAUTH_URL and CORS origins",
	},
	ALLOW_INDEXING: {
		required: false,
		description:
			'Set to "true" to allow search engine indexing — only set in the production deployment',
	},
	NODE_ENV: {
		required: false,
		description: "Environment (development, test, staging, production)",
	},
	PORT: { required: false, description: "Web server port" },
	AUTH_ALLOW_SIGNUP: {
		required: false,
		description:
			'Set to "false" to disable public self-service signup routes and UI',
	},

	// Worker
	WORKER_CONCURRENCY: {
		required: false,
		description: "Number of concurrent jobs per queue (default: 5)",
	},

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
	S3_ENDPOINT: {
		required: false,
		description:
			"S3-compatible endpoint URL (required for non-AWS providers: R2, MinIO, etc.)",
	},
	S3_ACCESS_KEY_ID: { required: false, description: "S3 access key" },
	S3_SECRET_ACCESS_KEY: { required: false, description: "S3 secret key" },
	S3_PUBLIC_URL: { required: false, description: "S3 public URL prefix" },
	ASSET_CDN_URL: {
		required: false,
		description:
			"Public CDN base URL for asset delivery — provider-agnostic (CloudFront, Cloudflare, Bunny, etc.). Falls back to /api/files when unset.",
	},

	// Admin seed (used by `pnpm db:seed` — not required at web/worker runtime)
	ADMIN_EMAIL: {
		required: false,
		description:
			"Admin user email address for initial database seed (default: admin@example.com)",
	},
	ADMIN_PASSWORD: {
		required: false,
		description:
			"Admin user password for initial database seed — required by seed script, min 12 characters",
	},
	ADMIN_NAME: {
		required: false,
		description:
			"Admin user display name for initial database seed (default: Admin)",
	},
};

/**
 * Validates environment variables against schema.
 *
 * @param {"web" | "worker"} [service="web"] — The service being validated.
 *   Worker skips web-only checks (e.g. NEXTAUTH_SECRET).
 * @throws {Error} If required environment variables are missing
 * @returns {{ validated: Object, warnings: string[] }}
 */
export function validateEnv(service = "web") {
	const errors = [];
	const warnings = [];
	const validated = {};
	const isTest = process.env.NODE_ENV === "test";

	// During Next.js build, runtime secrets are not (and should not be) available.
	// Skip strict validation — the server process will re-validate on first request.
	if (process.env.NEXT_PHASE === "phase-production-build") {
		return { validated: {}, warnings: [] };
	}

	// Web-only required fields that workers can skip
	const webOnlyRequired = new Set(["NEXTAUTH_SECRET"]);

	for (const [key, config] of Object.entries(envSchema)) {
		const value = process.env[key];

		// Skip web-only required checks for worker service
		const isRequired =
			config.required && !(service === "worker" && webOnlyRequired.has(key));

		if (isRequired && !value) {
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

	// --- Cross-field validation ---

	// Placeholder value security check
	const placeholderPattern = /^CHANGE_ME_/i;
	const criticalKeys = [
		"NEXTAUTH_SECRET",
		"POSTGRES_PASSWORD",
		"RESEND_API_KEY",
		"ZEPTOMAIL_TOKEN",
		"S3_SECRET_ACCESS_KEY",
		"SMTP_PASSWORD",
	];
	for (const key of criticalKeys) {
		const value = process.env[key];
		if (value && placeholderPattern.test(value)) {
			errors.push(
				`${key} contains a placeholder value — replace with a real secret (${envSchema[key]?.description || ""})`,
			);
		}
	}

	// Database: either DATABASE_URL or POSTGRES_USER must be set (skip in test)
	if (!isTest) {
		const hasDbUrl = !!process.env.DATABASE_URL;
		const hasPostgresUser = !!process.env.POSTGRES_USER;
		if (!hasDbUrl && !hasPostgresUser) {
			errors.push(
				"Database not configured: set DATABASE_URL or POSTGRES_USER + POSTGRES_PASSWORD + POSTGRES_DB",
			);
		}
	}

	// Redis: warn if not configured (defaults to localhost in dev, will fail in prod)
	const currentEnv = (process.env.NODE_ENV || "").toLowerCase();
	if (
		!process.env.REDIS_URL &&
		!process.env.REDIS_HOST &&
		(currentEnv === "production" || currentEnv === "staging")
	) {
		warnings.push(
			"Redis not configured: set REDIS_URL or REDIS_HOST (defaults to localhost)",
		);
	}

	// SEO metadata: APP_DESCRIPTION should be explicitly set before production
	const isProductionLike =
		currentEnv === "production" || currentEnv === "staging";
	if (!isTest && isProductionLike) {
		const appDescription = process.env.APP_DESCRIPTION;
		if (!appDescription) {
			warnings.push(
				"APP_DESCRIPTION not set: metadata description will fall back to a generic value. Set APP_DESCRIPTION before production.",
			);
		} else if (/^CHANGE_ME_|^TODO_/i.test(appDescription)) {
			warnings.push(
				"APP_DESCRIPTION appears to be a placeholder value. Update it before production.",
			);
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

	// Conditional: Zeptomail provider requires token and URL
	if (process.env.EMAIL_PROVIDER === "zeptomail") {
		if (!process.env.ZEPTOMAIL_TOKEN) {
			errors.push(
				"Missing ZEPTOMAIL_TOKEN — required when EMAIL_PROVIDER=zeptomail",
			);
		}
		if (!process.env.ZEPTOMAIL_URL) {
			errors.push(
				"Missing ZEPTOMAIL_URL — required when EMAIL_PROVIDER=zeptomail",
			);
		}
	}

	if (process.env.AUTH_ALLOW_SIGNUP) {
		const normalized = process.env.AUTH_ALLOW_SIGNUP.trim().toLowerCase();
		if (
			!["true", "false", "1", "0", "yes", "no", "on", "off"].includes(
				normalized,
			)
		) {
			errors.push(
				"AUTH_ALLOW_SIGNUP must be a boolean-like value (true/false/1/0/yes/no/on/off)",
			);
		}
	}

	// Log warnings (non-fatal)
	for (const warning of warnings) {
		console.warn(`[env] ⚠️  ${warning}`);
	}

	if (errors.length > 0) {
		const errorMessage = `Environment Validation Failed:\n${errors.join("\n")}`;
		throw new Error(errorMessage);
	}

	// Ensure NEXTAUTH_URL is derived from APP_URL when not explicitly set
	if (service === "web") {
		syncNextAuthUrl();

		// Include the (possibly derived) NEXTAUTH_URL in the validated object
		if (process.env.NEXTAUTH_URL && !validated.NEXTAUTH_URL) {
			validated.NEXTAUTH_URL = process.env.NEXTAUTH_URL;
		}
	}

	return { validated, warnings };
}

/**
 * Loads and validates environment variables.
 * Call this function at application startup.
 *
 * @param {"web" | "worker"} [service="web"]
 */
export function loadEnv(service = "web") {
	try {
		const { validated } = validateEnv(service);
		return validated;
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
