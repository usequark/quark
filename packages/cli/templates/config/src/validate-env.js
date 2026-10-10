import { createLogger } from "@usequark/quark-core/core";
import { ValidationError } from "@usequark/quark-core/errors";
import { z } from "zod";
import { syncNextAuthUrl } from "./app-url.js";

const log = createLogger("env");

function getResolvedNextAuthSecret() {
	return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || null;
}

const BOOLEAN_LIKE_VALUES = new Set([
	"true",
	"false",
	"1",
	"0",
	"yes",
	"no",
	"on",
	"off",
]);
const TRUTHY_VALUES = new Set(["true", "1", "yes", "on"]);
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBooleanLike(value) {
	return BOOLEAN_LIKE_VALUES.has(value.trim().toLowerCase());
}

function isTruthyLike(value) {
	return TRUTHY_VALUES.has(value.trim().toLowerCase());
}

function isAbsoluteHttpUrl(value) {
	try {
		const parsed = new URL(value);
		return ["http:", "https:"].includes(parsed.protocol);
	} catch {
		return false;
	}
}

function isUuid(value) {
	return UUID_PATTERN.test(value.trim());
}

/**
 * Environment variable field descriptions (used in error messages).
 */
const ENV_DESCRIPTIONS = {
	// Database
	DATABASE_URL: "PostgreSQL connection string",
	POSTGRES_HOST: "PostgreSQL host",
	POSTGRES_PORT: "PostgreSQL port",
	POSTGRES_USER: "PostgreSQL user",
	POSTGRES_PASSWORD: "PostgreSQL password",
	POSTGRES_DB: "PostgreSQL database name",

	// Redis
	REDIS_URL: "Redis connection string",
	REDIS_HOST: "Redis host",
	REDIS_PORT: "Redis port",

	// Mail (local SMTP - Mailpit in dev)
	MAIL_HOST: "Mail host",
	MAIL_SMTP_PORT: "Mail SMTP port",
	MAIL_UI_PORT: "Mail UI port",

	// Production SMTP (used when SMTP_HOST is set)
	SMTP_HOST: "Production SMTP host",
	SMTP_PORT: "Production SMTP port",
	SMTP_SECURE: "Use TLS for SMTP",
	SMTP_USER: "SMTP username",
	SMTP_PASSWORD: "SMTP password",

	// Email provider
	EMAIL_PROVIDER: 'Email provider - "smtp" (default), "resend", or "zeptomail"',
	EMAIL_FROM: "Sender email address",
	RESEND_API_KEY: "Resend API key",
	ZEPTOMAIL_TOKEN: "Zeptomail API token",
	ZEPTOMAIL_URL: "Zeptomail API base URL",
	ZEPTOMAIL_BOUNCE_EMAIL: "Zeptomail bounce email address",

	// NextAuth
	NEXTAUTH_SECRET: "NextAuth secret for JWT signing",
	NEXTAUTH_URL: "NextAuth callback URL (derived from APP_URL if not set)",

	// OAuth (optional — each provider is inert unless its client id is set)
	GITHUB_ID: "GitHub OAuth client id for NextAuth sign-in",
	GITHUB_SECRET: "GitHub OAuth client secret for NextAuth sign-in",
	GOOGLE_CLIENT_ID:
		"Google OAuth client id — enables POST /api/auth/google and the id token audience check",
	GOOGLE_CLIENT_SECRET: "Google OAuth client secret for NextAuth sign-in",
	APPLE_CLIENT_ID:
		"Apple Services ID — enables POST /api/auth/apple and the identity token audience check",

	// Application
	APP_NAME: "Application name - used in metadata, emails, and page titles",
	APP_DESCRIPTION:
		"Application description - used for SEO metadata and social previews",
	APP_URL: "Canonical application URL - derives NEXTAUTH_URL and CORS origins",
	NEXT_PUBLIC_UMAMI_URL:
		"Public Umami base URL for script.js and replay uploads",
	NEXT_PUBLIC_UMAMI_WEBSITE_ID: "Public Umami website UUID",
	NEXT_PUBLIC_UMAMI_REPLAY_ENABLED:
		"Enable local rrweb session replay uploads to Umami",
	ALLOW_INDEXING:
		'Set to "true" to allow search engine indexing - only set in the production deployment',
	NODE_ENV: "Environment (development, test, staging, production)",
	PORT: "Web server port",
	AUTH_ALLOW_SIGNUP:
		'Set to "false" to disable public self-service signup routes and UI',

	// Worker
	WORKER_CONCURRENCY: "Number of concurrent jobs per queue (default: 5)",

	// Storage
	STORAGE_PROVIDER: 'Storage provider - "local" (default) or "s3"',
	STORAGE_LOCAL_DIR: "Local storage directory",
	S3_BUCKET: "S3 bucket name",
	S3_REGION: "S3 region",
	S3_ENDPOINT:
		"S3-compatible endpoint URL (required for non-AWS providers: R2, MinIO, etc.)",
	S3_ACCESS_KEY_ID: "S3 access key",
	S3_SECRET_ACCESS_KEY: "S3 secret key",
	S3_PUBLIC_URL: "S3 public URL prefix",
	ASSET_CDN_URL:
		"Public CDN base URL for asset delivery - provider-agnostic (CloudFront, Cloudflare, Bunny, etc.). Falls back to /api/files when unset.",

	// Database instrumentation
	DB_INSTRUMENTATION:
		'Database query instrumentation — set to "false", "0", or "off" to disable Prisma $extends middleware with parameter masking (default: enabled)',
	DB_SLOW_QUERY_THRESHOLD:
		"Slow query threshold in milliseconds — queries exceeding this duration are logged as warnings (default: 500)",

	// Admin
	ADMIN_API_TOKEN:
		"Bearer token protecting admin-only API routes (e.g. /api/admin/db-health). Strongly recommended in production.",

	// Admin seed (used by `pnpm db:seed` — not required at web/worker runtime)
	ADMIN_EMAIL:
		"Admin user email address for initial database seed (default: admin@example.com)",
	ADMIN_PASSWORD:
		"Admin user password for initial database seed - required by seed script, min 12 characters",
	ADMIN_NAME:
		"Admin user display name for initial database seed (default: Admin)",
};

const ENV_KEYS = Object.keys(ENV_DESCRIPTIONS);

const optionalString = z.string().optional();

const absoluteHttpUrl = (message) =>
	z
		.string()
		.refine((value) => isAbsoluteHttpUrl(value.trim()), { message })
		.optional();

const booleanLike = (message) =>
	z
		.string()
		.refine((value) => isBooleanLike(value), { message })
		.optional();

/**
 * Builds a Zod schema for environment validation.
 *
 * @param {"web" | "worker"} service
 * @returns {z.ZodObject}
 */
function createEnvSchema(service) {
	const isTest = process.env.NODE_ENV === "test";
	const nextAuthRequired = service !== "worker";

	const nextAuthSecret = nextAuthRequired
		? z
				.string({
					error: `Missing required environment variable: NEXTAUTH_SECRET (${ENV_DESCRIPTIONS.NEXTAUTH_SECRET})`,
				})
				.min(
					32,
					`NEXTAUTH_SECRET must be at least 32 characters (${ENV_DESCRIPTIONS.NEXTAUTH_SECRET})`,
				)
		: z
				.string()
				.min(
					32,
					`NEXTAUTH_SECRET must be at least 32 characters (${ENV_DESCRIPTIONS.NEXTAUTH_SECRET})`,
				)
				.optional();

	return z
		.object({
			// Database
			DATABASE_URL: optionalString,
			POSTGRES_HOST: optionalString,
			POSTGRES_PORT: optionalString,
			POSTGRES_USER: optionalString,
			POSTGRES_PASSWORD: optionalString,
			POSTGRES_DB: optionalString,

			// Redis
			REDIS_URL: optionalString,
			REDIS_HOST: optionalString,
			REDIS_PORT: optionalString,

			// Mail (local SMTP - Mailpit in dev)
			MAIL_HOST: optionalString,
			MAIL_SMTP_PORT: optionalString,
			MAIL_UI_PORT: optionalString,

			// Production SMTP
			SMTP_HOST: optionalString,
			SMTP_PORT: optionalString,
			SMTP_SECURE: optionalString,
			SMTP_USER: optionalString,
			SMTP_PASSWORD: optionalString,

			// Email provider
			EMAIL_PROVIDER: optionalString,
			EMAIL_FROM: optionalString,
			RESEND_API_KEY: optionalString,
			ZEPTOMAIL_TOKEN: optionalString,
			ZEPTOMAIL_URL: optionalString,
			ZEPTOMAIL_BOUNCE_EMAIL: optionalString,

			// NextAuth
			NEXTAUTH_SECRET: nextAuthSecret,
			NEXTAUTH_URL: absoluteHttpUrl(
				"NEXTAUTH_URL must be an absolute http(s) URL",
			),

			// OAuth (optional — each provider is inert unless its client id is set)
			GITHUB_ID: optionalString,
			GITHUB_SECRET: optionalString,
			GOOGLE_CLIENT_ID: optionalString,
			GOOGLE_CLIENT_SECRET: optionalString,
			APPLE_CLIENT_ID: optionalString,

			// Application
			APP_NAME: optionalString,
			APP_DESCRIPTION: optionalString,
			APP_URL: absoluteHttpUrl("APP_URL must be an absolute http(s) URL"),
			NEXT_PUBLIC_UMAMI_URL: absoluteHttpUrl(
				"NEXT_PUBLIC_UMAMI_URL must be an absolute http(s) URL",
			),
			NEXT_PUBLIC_UMAMI_WEBSITE_ID: z
				.string()
				.refine((value) => isUuid(value), {
					message: "NEXT_PUBLIC_UMAMI_WEBSITE_ID must be a UUID",
				})
				.optional(),
			NEXT_PUBLIC_UMAMI_REPLAY_ENABLED: booleanLike(
				"NEXT_PUBLIC_UMAMI_REPLAY_ENABLED must be a boolean-like value (true/false/1/0/yes/no/on/off)",
			),
			ALLOW_INDEXING: optionalString,
			NODE_ENV: optionalString,
			PORT: optionalString,
			AUTH_ALLOW_SIGNUP: booleanLike(
				"AUTH_ALLOW_SIGNUP must be a boolean-like value (true/false/1/0/yes/no/on/off)",
			),

			// Worker
			WORKER_CONCURRENCY: optionalString,

			// Storage
			STORAGE_PROVIDER: optionalString,
			STORAGE_LOCAL_DIR: optionalString,
			S3_BUCKET: optionalString,
			S3_REGION: optionalString,
			S3_ENDPOINT: optionalString,
			S3_ACCESS_KEY_ID: optionalString,
			S3_SECRET_ACCESS_KEY: optionalString,
			S3_PUBLIC_URL: optionalString,
			ASSET_CDN_URL: optionalString,

			// Database instrumentation
			DB_INSTRUMENTATION: optionalString,
			DB_SLOW_QUERY_THRESHOLD: optionalString,

			// Admin
			ADMIN_API_TOKEN: optionalString,
			ADMIN_EMAIL: optionalString,
			ADMIN_PASSWORD: optionalString,
			ADMIN_NAME: optionalString,
		})
		.superRefine((data, ctx) => {
			// Placeholder value security check
			const placeholderPattern = /^CHANGE_ME_/i;
			const criticalKeys = [
				"NEXTAUTH_SECRET",
				"AUTH_SECRET",
				"POSTGRES_PASSWORD",
				"RESEND_API_KEY",
				"ZEPTOMAIL_TOKEN",
				"S3_SECRET_ACCESS_KEY",
				"SMTP_PASSWORD",
			];
			for (const key of criticalKeys) {
				const value = process.env[key];
				if (value && placeholderPattern.test(value)) {
					ctx.addIssue({
						code: "custom",
						message: `${key} contains a placeholder value - replace with a real secret (${ENV_DESCRIPTIONS[key] || ""})`,
					});
				}
			}

			// Database: either DATABASE_URL or POSTGRES_USER must be set (skip in test)
			if (!isTest) {
				const hasDbUrl = !!process.env.DATABASE_URL;
				const hasPostgresUser = !!process.env.POSTGRES_USER;
				if (!hasDbUrl && !hasPostgresUser) {
					ctx.addIssue({
						code: "custom",
						message:
							"Database not configured: set DATABASE_URL or POSTGRES_USER + POSTGRES_PASSWORD + POSTGRES_DB",
					});
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
						ctx.addIssue({
							code: "custom",
							message: `Missing ${key} - required when STORAGE_PROVIDER=s3 (${ENV_DESCRIPTIONS[key]})`,
						});
					}
				}
			}

			// Conditional: Resend provider requires API key
			if (
				process.env.EMAIL_PROVIDER === "resend" &&
				!process.env.RESEND_API_KEY
			) {
				ctx.addIssue({
					code: "custom",
					message:
						"Missing RESEND_API_KEY - required when EMAIL_PROVIDER=resend",
				});
			}

			// Conditional: Zeptomail provider requires token and URL
			if (process.env.EMAIL_PROVIDER === "zeptomail") {
				if (!process.env.ZEPTOMAIL_TOKEN) {
					ctx.addIssue({
						code: "custom",
						message:
							"Missing ZEPTOMAIL_TOKEN - required when EMAIL_PROVIDER=zeptomail",
					});
				}
				if (!process.env.ZEPTOMAIL_URL) {
					ctx.addIssue({
						code: "custom",
						message:
							"Missing ZEPTOMAIL_URL - required when EMAIL_PROVIDER=zeptomail",
					});
				}
			}

			// Umami replay requires full analytics contract
			const umamiUrl = data.NEXT_PUBLIC_UMAMI_URL?.trim();
			const umamiWebsiteId = data.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
			const umamiReplayEnabled = data.NEXT_PUBLIC_UMAMI_REPLAY_ENABLED?.trim();
			const hasUmamiUrl = Boolean(umamiUrl);
			const hasUmamiWebsiteId = Boolean(umamiWebsiteId);

			if (
				umamiReplayEnabled &&
				isTruthyLike(umamiReplayEnabled) &&
				(!hasUmamiUrl || !hasUmamiWebsiteId)
			) {
				ctx.addIssue({
					code: "custom",
					message:
						"NEXT_PUBLIC_UMAMI_REPLAY_ENABLED requires NEXT_PUBLIC_UMAMI_URL and NEXT_PUBLIC_UMAMI_WEBSITE_ID.",
				});
			}
		});
}

/**
 * Collects non-fatal environment warnings.
 *
 * @returns {string[]}
 */
function collectWarnings() {
	const warnings = [];
	const isTest = process.env.NODE_ENV === "test";
	const currentEnv = (process.env.NODE_ENV || "").toLowerCase();
	const isProductionLike =
		currentEnv === "production" || currentEnv === "staging";

	// Redis: warn if not configured (defaults to localhost in dev, will fail in prod)
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

	// Canonical origin: without it, Auth.js derives localhost and post-sign-in
	// redirects can point at a different origin than the one the cookie was
	// issued for (symptom: you land back on the homepage signed out).
	if (!isTest && isProductionLike && !process.env.APP_URL) {
		warnings.push(
			"APP_URL not set: Auth.js and CORS origins will fall back to http://localhost. Set APP_URL to your real https origin before production.",
		);
	}

	// OAuth: half a provider is a provider that silently does not work.
	// `auth.js` only registers a NextAuth provider when BOTH the client id and
	// the secret are set, so an id with no secret leaves the sign-in button
	// absent and the failure looks like a missing feature rather than a
	// half-finished configuration. Worth saying out loud.
	for (const [idKey, secretKey, label] of [
		["GITHUB_ID", "GITHUB_SECRET", "GitHub"],
		["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "Google"],
	]) {
		const hasId = Boolean(process.env[idKey]?.trim());
		const hasSecret = Boolean(process.env[secretKey]?.trim());
		if (hasId !== hasSecret) {
			warnings.push(
				`${label} OAuth is incomplete: set both ${idKey} and ${secretKey} to enable it. The sign-in button stays hidden until both are present.`,
			);
		}
	}

	// Umami pair completeness
	const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL?.trim();
	const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
	const hasUmamiUrl = Boolean(umamiUrl);
	const hasUmamiWebsiteId = Boolean(umamiWebsiteId);
	if (hasUmamiUrl !== hasUmamiWebsiteId) {
		warnings.push(
			"Umami analytics is incomplete: set both NEXT_PUBLIC_UMAMI_URL and NEXT_PUBLIC_UMAMI_WEBSITE_ID to enable tracking.",
		);
	}

	return warnings;
}

/**
 * Builds the env input object for Zod parsing.
 * Only includes defined, non-empty values (matching prior validated output).
 *
 * @returns {Record<string, string>}
 */
function buildEnvInput() {
	/** @type {Record<string, string>} */
	const input = {};

	for (const key of ENV_KEYS) {
		const value =
			key === "NEXTAUTH_SECRET"
				? getResolvedNextAuthSecret()
				: process.env[key];

		if (value) {
			input[key] = value;
		}
	}

	return input;
}

/**
 * Validates environment variables against schema.
 *
 * @param {"web" | "worker"} [service="web"] - The service being validated.
 *   Worker skips web-only checks (e.g. NEXTAUTH_SECRET).
 * @throws {ValidationError} If required environment variables are missing
 * @returns {{ validated: Object, warnings: string[] }}
 */
export function validateEnv(service = "web") {
	// During Next.js build, runtime secrets are not (and should not be) available.
	// Skip strict validation - the server process will re-validate on first request.
	if (process.env.NEXT_PHASE === "phase-production-build") {
		return { validated: {}, warnings: [] };
	}

	const warnings = collectWarnings();

	// Log warnings (non-fatal)
	for (const warning of warnings) {
		log.warn(warning);
	}

	const schema = createEnvSchema(service);
	const input = buildEnvInput();
	const result = schema.safeParse(input);

	if (!result.success) {
		const errors = result.error.issues.map((issue) => issue.message);
		const errorMessage = `Environment Validation Failed:\n${errors.join("\n")}`;
		throw new ValidationError(errorMessage);
	}

	/** @type {Record<string, string>} */
	const validated = {};
	for (const [key, value] of Object.entries(result.data)) {
		if (value !== undefined && value !== null && value !== "") {
			validated[key] = value;
		}
	}

	// Ensure NEXTAUTH_URL is derived from APP_URL when not explicitly set
	if (service === "web") {
		if (!process.env.NEXTAUTH_SECRET && process.env.AUTH_SECRET) {
			process.env.NEXTAUTH_SECRET = process.env.AUTH_SECRET;
		}

		syncNextAuthUrl();

		// Include the (possibly derived) NEXTAUTH_URL in the validated object
		if (process.env.NEXTAUTH_URL && !validated.NEXTAUTH_URL) {
			validated.NEXTAUTH_URL = process.env.NEXTAUTH_URL;
		}

		if (process.env.NEXTAUTH_SECRET && !validated.NEXTAUTH_SECRET) {
			validated.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
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
		log.error(error.message);
		process.exit(1);
	}
}
