/**
 * Next.js Middleware
 * Handles rate limiting, CORS, and security headers
 */

import { getAllowedOrigins } from "@bobnoddle/quark-config/app-url";
import { NextResponse } from "next/server";

// Simple in-memory rate limiter (use Redis for production)
const rateLimit = new Map();

const RATE_LIMIT_CONFIG = {
	windowMs: 15 * 60 * 1000, // 15 minutes
	maxRequests: {
		api: 100, // 100 requests per 15 minutes for general API
		auth: 5, // 5 requests per 15 minutes for auth endpoints
	},
};

/**
 * Rate limiting implementation
 */
function checkRateLimit(ip, path) {
	const now = Date.now();
	const key = `${ip}:${path}`;

	// Determine which limit to use
	const isAuthEndpoint = path.startsWith("/api/auth/");
	const maxRequests = isAuthEndpoint
		? RATE_LIMIT_CONFIG.maxRequests.auth
		: RATE_LIMIT_CONFIG.maxRequests.api;

	// Get or create rate limit record
	const record = rateLimit.get(key) || {
		count: 0,
		resetTime: now + RATE_LIMIT_CONFIG.windowMs,
	};

	// Reset if window has passed
	if (now > record.resetTime) {
		record.count = 0;
		record.resetTime = now + RATE_LIMIT_CONFIG.windowMs;
	}

	// Check if limit exceeded
	if (record.count >= maxRequests) {
		return {
			limited: true,
			resetTime: record.resetTime,
			remaining: 0,
		};
	}

	// Increment counter
	record.count++;
	rateLimit.set(key, record);

	return {
		limited: false,
		resetTime: record.resetTime,
		remaining: maxRequests - record.count,
	};
}

/**
 * Clean up old rate limit records periodically
 */
setInterval(() => {
	const now = Date.now();
	for (const [key, record] of rateLimit.entries()) {
		if (now > record.resetTime) {
			rateLimit.delete(key);
		}
	}
}, 60 * 1000); // Clean up every minute

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
	"X-XSS-Protection": "1; mode=block",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * Request size limits (in bytes)
 */
const REQUEST_SIZE_LIMITS = {
	api: parseInt(process.env.API_BODY_SIZE_LIMIT || "2097152", 10), // 2MB default
	upload: parseInt(process.env.UPLOAD_SIZE_LIMIT || "10485760", 10), // 10MB for uploads
};

export function middleware(request) {
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
		const rateLimitResult = checkRateLimit(ip, pathname);

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
							? RATE_LIMIT_CONFIG.maxRequests.auth.toString()
							: RATE_LIMIT_CONFIG.maxRequests.api.toString(),
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
				? RATE_LIMIT_CONFIG.maxRequests.auth.toString()
				: RATE_LIMIT_CONFIG.maxRequests.api.toString(),
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

// Configure which routes the middleware runs on
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
