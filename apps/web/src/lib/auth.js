import { PrismaAdapter } from "@auth/prisma-adapter";
import {
	createAuthConfig,
	createLogger,
	verifyPassword,
} from "@techstream/quark-core";
import { Prisma, prisma, user } from "@techstream/quark-db";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

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
				const existingUser = await user.findByEmail(credentials.email);

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
		}),
	);
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
			strategy: "jwt",
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
