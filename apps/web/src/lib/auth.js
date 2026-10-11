import { PrismaAdapter } from "@auth/prisma-adapter";
import { createAuthConfig, verifyPassword } from "@usequark/quark-core/auth";
import { createLogger } from "@usequark/quark-core/core";
import { AppError } from "@usequark/quark-core/errors";
import { Prisma, prisma, user as userQueries } from "@usequark/quark-db";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { isEmailVerified } from "./email-verified";

const logger = createLogger({ name: "auth" });
const STALE_SESSION_PATTERN = /jwtsessionerror|no matching decryption secret/i;

function describeAuthIssue(issue, seen = new Set()) {
	if (!issue) {
		return "";
	}

	if (typeof issue === "string") {
		return issue;
	}

	if (typeof issue === "number" || typeof issue === "boolean") {
		return String(issue);
	}

	if (typeof issue !== "object" || seen.has(issue)) {
		return "";
	}

	seen.add(issue);

	const parts = [];
	for (const key of ["name", "type", "code", "message"]) {
		const value = issue[key];
		if (typeof value === "string" && value) {
			parts.push(value);
		}
	}

	for (const key of ["cause", "error", "details"]) {
		const nested = describeAuthIssue(issue[key], seen);
		if (nested) {
			parts.push(nested);
		}
	}

	return parts.join(" ");
}

function isIgnorableSessionError(issue) {
	return STALE_SESSION_PATTERN.test(describeAuthIssue(issue));
}

const providers = [
	CredentialsProvider({
		name: "Credentials",
		credentials: {
			email: { label: "Email", type: "email" },
			password: { label: "Password", type: "password" },
		},
		async authorize(credentials) {
			if (!credentials?.email || !credentials?.password) {
				return null;
			}

			try {
				const existingUser = await userQueries.findByEmail(credentials.email);

				if (!existingUser?.password) {
					return null;
				}

				const isValid = await verifyPassword(
					credentials.password,
					existingUser.password,
				);

				if (!isValid) {
					return null;
				}

				return {
					id: existingUser.id,
					email: existingUser.email,
					name: existingUser.name,
					image: existingUser.image,
					role: existingUser.role,
				};
			} catch (err) {
				// Re-throw if the database is unreachable so Auth.js surfaces a server error
				// rather than "Invalid credentials", which misleads both user and developer.
				// PrismaClientInitializationError: client could not connect on startup.
				// PrismaClientKnownRequestError P1xxx: connection lost / timeout mid-request.
				const isDbDown =
					err instanceof Prisma.PrismaClientInitializationError ||
					(err instanceof Prisma.PrismaClientKnownRequestError &&
						err.errorCode?.startsWith("P1"));
				if (isDbDown) {
					logger.error("Database unavailable during authentication", {
						errorCode: err.errorCode,
					});
					throw err;
				}
				// For all other unexpected errors, log and fail closed.
				logger.error("Auth authorize error", {
					message: err?.message ?? String(err),
				});
				return null;
			}
		},
	}),
];

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
	providers.push(
		GithubProvider({
			clientId: process.env.GITHUB_ID,
			clientSecret: process.env.GITHUB_SECRET,
		}),
	);
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
	providers.push(
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			// The web sign-in creates its account on first sight through the
			// Prisma adapter, so an unconfirmed address here means the same thing it
			// does on the mobile route: the confirmation that is supposed to
			// establish ownership of the address never happened. Google does issue
			// tokens for unconfirmed addresses.
			//
			// The refusal is thrown rather than returned, and that is deliberate.
			// Auth.js has no "null means refuse" contract: `getUserAndAccount` reads
			// `profile.email` straight off whatever the mapper hands back, so a null
			// denial works only because it trips a TypeError that is caught and
			// logged as `OAuthProfileParseError` — indistinguishable, in the log, from
			// a malformed provider response or a user who cancelled. Throwing says
			// why in the one place an operator can read it, and lands in the same
			// catch: no session, no user row, redirect back to the sign-in page.
			profile: (profile) => {
				if (!isEmailVerified(profile.email_verified)) {
					throw new AppError(
						"Google sign-in refused: the account's email address is not verified",
						401,
						"OAUTH_EMAIL_NOT_VERIFIED",
					);
				}

				return profile;
			},
		}),
	);
}

/**
 * Re-validate the session against the database on every request.
 *
 * Web sessions are signed JWTs: a credentials provider forces the JWT
 * strategy (Auth.js rejects `strategy: "database"` when every provider is
 * credentials, and scaffolds always ship one), and the cookie would otherwise
 * stay valid for its full 30 days no matter what happened to the account
 * behind it. That was the review's "logins can't be revoked" finding — banning
 * a user, demoting an admin, or changing a password did nothing until the
 * token expired on its own.
 *
 * The revocation check is a single indexed primary-key read, which is the
 * same cost Auth.js itself pays for database sessions — but it works for
 * credentials apps too:
 *
 *   - user gone (deleted / banned by deletion)  → reject, cookie cleared
 *   - `passwordChangedAt` after the token's iat → reject, cookie cleared
 *   - role or profile changed                   → refreshed into the token,
 *     so `requireRole` reads the current role, not the sign-in-time one
 *
 * Returning null from the `jwt` callback is Auth.js's documented "invalidate
 * this session" signal: it clears the cookie and the request continues
 * unauthenticated.
 */
async function validateSessionToken(token) {
	if (typeof token.id !== "string" || token.id.length === 0) {
		return null;
	}

	try {
		const account = await userQueries.findById(token.id);

		if (!account) {
			return null;
		}

		if (
			account.passwordChangedAt &&
			typeof token.iat === "number" &&
			account.passwordChangedAt.getTime() / 1000 > token.iat
		) {
			return null;
		}

		token.email = account.email;
		token.name = account.name;
		token.role = account.role;
		return token;
	} catch (err) {
		// Fail closed: an unreachable database invalidates the session rather
		// than letting an unverified cookie through. The next request retries.
		logger.error("Session validation failed", {
			message: err?.message ?? String(err),
		});
		return null;
	}
}

export function getAuthOptions() {
	return createAuthConfig({
		adapter: PrismaAdapter(prisma),
		providers: providers,
		logger: {
			error(...issues) {
				if (issues.some(isIgnorableSessionError)) {
					return;
				}

				logger.error("Auth.js error", {
					details: issues.map((issue) => describeAuthIssue(issue)).join(" | "),
				});
			},
		},
		session: {
			// JWT is not a preference here, it is a constraint: Auth.js throws
			// `UnsupportedStrategy` when strategy is "database" and every
			// configured provider is credentials, and the scaffold always ships
			// the credentials provider. Revocation is therefore enforced by
			// `validateSessionToken` above, not by server-side session rows.
			strategy: "jwt",
			maxAge: 30 * 24 * 60 * 60, // 30 days
		},
		callbacks: {
			async jwt({ token, user: signedInUser }) {
				// Sign-in: stamp the identity once; the DB check below is for
				// every subsequent request.
				if (signedInUser) {
					token.id = signedInUser.id;
					token.email = signedInUser.email;
					token.name = signedInUser.name;
					token.role = signedInUser.role || "viewer";
					return token;
				}

				return validateSessionToken(token);
			},
		},
	});
}

let authInstance = null;

function getAuthInstance() {
	if (!authInstance) {
		authInstance = NextAuth(getAuthOptions());
	}
	return authInstance;
}

export function getAuth() {
	return getAuthInstance();
}

export async function auth() {
	try {
		return await getAuthInstance().auth();
	} catch (error) {
		if (isIgnorableSessionError(error)) {
			return null;
		}

		throw error;
	}
}

export const handlers = new Proxy(
	{},
	{
		get(_target, prop) {
			return getAuthInstance().handlers[prop];
		},
	},
);

export const signIn = (...args) => getAuthInstance().signIn(...args);
export const signOut = (...args) => getAuthInstance().signOut(...args);
