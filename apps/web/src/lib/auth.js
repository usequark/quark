import { PrismaAdapter } from "@auth/prisma-adapter";
import { createAuthConfig, verifyPassword } from "@techstream/quark-core";
import { prisma, user } from "@techstream/quark-db";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

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

			const existingUser = await user.findByEmail(credentials.email);

			if (!existingUser || !existingUser.password) {
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
	return getAuthInstance().auth();
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
