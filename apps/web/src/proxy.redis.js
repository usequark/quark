/**
 * Next.js Proxy - Redis-based Rate Limiting
 * Use this version for production deployments with multiple instances
 *
 * To enable Redis-based rate limiting:
 * 1. Install ioredis: pnpm add ioredis
 * 2. Set REDIS_URL environment variable
 * 3. Replace proxy.js with this file (or use the hybrid approach below)
 */

import { getAllowedOrigins } from "@techstream/quark-config/app-url";
import {
	createLogger,
	createRateLimiter,
	RATE_LIMIT_PRESETS,
} from "@techstream/quark-core";
import { NextResponse } from "next/server";

const logger = createLogger("proxy");

// Initialize Redis client (lazy initialization)
let redisClient = null;
let rateLimiter = null;

async function getRateLimiter() {
	if (rateLimiter) return rateLimiter;

	// Only use Redis if REDIS_URL is configured
	if (process.env.REDIS_URL) {
		try {
			// Dynamically import ioredis only if needed
			const { default: Redis } = await import("ioredis");
			redisClient = new Redis(process.env.REDIS_URL, {
				maxRetriesPerRequest: 3,
				enableReadyCheck: true,
				retryStrategy(times) {
					const delay = Math.min(times * 50, 2000);
					return delay;
				},
			});

			rateLimiter = createRateLimiter({
				type: "redis",
				redisClient,
			});

			logger.info("Redis-based rate limiting enabled");
		} catch (error) {
			logger.error("Failed to initialize Redis rate limiter", {
				error: error.message,
			});
			logger.warn("Falling back to in-memory rate limiting");
			rateLimiter = createRateLimiter({ type: "memory" });
		}
	} else {
		logger.warn("REDIS_URL not set, using in-memory rate limiting");
		rateLimiter = createRateLimiter({ type: "memory" });
	}

	return rateLimiter;
}

/**
 * Rate limiting check
 */
async function checkRateLimit(ip, path) {
	const limiter = await getRateLimiter();

	// Determine which preset to use
	const isAuthEndpoint = path.startsWith("/api/auth/");
	const preset = isAuthEndpoint
		? RATE_LIMIT_PRESETS.auth
		: RATE_LIMIT_PRESETS.api;

	const key = `${ip}:${path}`;
	return limiter.checkLimit(key, preset.maxRequests, preset.windowMs);
}

/**
 * CORS configuration
 */
const CORS_CONFIG = {
	allowedOrigins: getAllowedOrigins(),
	allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
	exposedHeaders: [
		"X-RateLimit-Limit",
		"X-RateLimit-Remaining",
		"X-RateLimit-Reset",
	],
	credentials: true,
	maxAge: 86400, // 24 hours
};

/**
 * Security headers configuration
 */
const SECURITY_HEADERS = {
	"X-DNS-Prefetch-Control": "on",
	"Strict-Transport-Security": "max-age=63072000; includeSubDomains",
	"X-Frame-Options": "SAMEORIGIN",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
	"Content-Security-Policy":
		"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';",
};

/**
 * Request size limits (in bytes)
 */
const REQUEST_SIZE_LIMITS = {
	api: parseInt(process.env.API_BODY_SIZE_LIMIT || "2097152", 10), // 2MB default
	upload: parseInt(process.env.UPLOAD_SIZE_LIMIT || "10485760", 10), // 10MB for uploads
};

export async function proxy(request) {
	const { pathname } = request.nextUrl;
	const origin = request.headers.get("origin") || "";

	// Create response
	const response = NextResponse.next();

	// Check request body size for API routes
	if (
		pathname.startsWith("/api/") &&
		["POST", "PUT", "PATCH"].includes(request.method)
	) {
		const contentLength = request.headers.get("content-length");
		if (contentLength) {
			const size = parseInt(contentLength, 10);
			const limit = pathname.startsWith("/api/upload")
				? REQUEST_SIZE_LIMITS.upload
				: REQUEST_SIZE_LIMITS.api;

			if (size > limit) {
				return new NextResponse(
					JSON.stringify({
						error: "Payload too large",
						message: `Request body size exceeds limit of ${Math.round(limit / 1024 / 1024)}MB`,
						maxSize: limit,
					}),
					{
						status: 413,
						headers: {
							"Content-Type": "application/json",
						},
					},
				);
			}
		}
	}

	// Apply rate limiting to API routes only
	if (pathname.startsWith("/api/")) {
		const ip =
			request.ip || request.headers.get("x-forwarded-for") || "unknown";
		const rateLimitResult = await checkRateLimit(ip, pathname);

		if (rateLimitResult.limited) {
			const retryAfter = Math.ceil(
				(rateLimitResult.resetTime - Date.now()) / 1000,
			);
			return new NextResponse(
				JSON.stringify({
					error: "Too many requests",
					message: "You have exceeded the rate limit. Please try again later.",
					retryAfter,
				}),
				{
					status: 429,
					headers: {
						"Content-Type": "application/json",
						"Retry-After": retryAfter.toString(),
						"X-RateLimit-Limit": pathname.startsWith("/api/auth/")
							? RATE_LIMIT_PRESETS.auth.maxRequests.toString()
							: RATE_LIMIT_PRESETS.api.maxRequests.toString(),
						"X-RateLimit-Remaining": "0",
						"X-RateLimit-Reset": new Date(
							rateLimitResult.resetTime,
						).toISOString(),
					},
				},
			);
		}

		// Add rate limit headers to response
		response.headers.set(
			"X-RateLimit-Limit",
			pathname.startsWith("/api/auth/")
				? RATE_LIMIT_PRESETS.auth.maxRequests.toString()
				: RATE_LIMIT_PRESETS.api.maxRequests.toString(),
		);
		response.headers.set(
			"X-RateLimit-Remaining",
			rateLimitResult.remaining.toString(),
		);
		response.headers.set(
			"X-RateLimit-Reset",
			new Date(rateLimitResult.resetTime).toISOString(),
		);
	}

	// Handle CORS for API routes
	if (pathname.startsWith("/api/")) {
		// Check if origin is allowed
		const isAllowedOrigin =
			CORS_CONFIG.allowedOrigins.includes("*") ||
			CORS_CONFIG.allowedOrigins.includes(origin);

		if (isAllowedOrigin || !origin) {
			response.headers.set(
				"Access-Control-Allow-Origin",
				origin || CORS_CONFIG.allowedOrigins[0],
			);
			response.headers.set(
				"Access-Control-Allow-Methods",
				CORS_CONFIG.allowedMethods.join(", "),
			);
			response.headers.set(
				"Access-Control-Allow-Headers",
				CORS_CONFIG.allowedHeaders.join(", "),
			);
			response.headers.set(
				"Access-Control-Expose-Headers",
				CORS_CONFIG.exposedHeaders.join(", "),
			);
			response.headers.set(
				"Access-Control-Max-Age",
				CORS_CONFIG.maxAge.toString(),
			);

			if (CORS_CONFIG.credentials) {
				response.headers.set("Access-Control-Allow-Credentials", "true");
			}
		}

		// Handle preflight requests
		if (request.method === "OPTIONS") {
			return new NextResponse(null, {
				status: 204,
				headers: response.headers,
			});
		}
	}

	// Apply security headers
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}

	return response;
}

// Configure which routes the proxy runs on
export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public folder
		 */
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
