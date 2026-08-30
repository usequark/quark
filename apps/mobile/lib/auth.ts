import { apiClient } from "./api-client";
import { getConfig } from "./config";
import { storeTokens, clearTokens, getToken } from "./storage";

interface TokenResponse {
	token: string;
	refreshToken: string;
	expiresAt: string;
}

interface RefreshResponse {
	token: string;
}

interface UserProfile {
	id: string;
	email: string;
	name: string | null;
	role: string;
}

export async function signIn(email: string, password: string): Promise<void> {
	const config = getConfig();
	const response = await fetch(`${config.apiUrl}/api/auth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => null);
		throw new Error(error?.message || "Invalid credentials");
	}

	const data: TokenResponse = await response.json();
	await storeTokens(data.token, data.refreshToken);
}

export async function signOut(): Promise<void> {
	await clearTokens();
}

export async function refreshToken(): Promise<string> {
	const { getRefreshToken } = await import("./storage");
	const refreshTokenValue = await getRefreshToken();
	if (!refreshTokenValue) throw new Error("No refresh token");

	const config = getConfig();
	const response = await fetch(`${config.apiUrl}/api/auth/refresh`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ refreshToken: refreshTokenValue }),
	});

	if (!response.ok) {
		await clearTokens();
		throw new Error("Token refresh failed");
	}

	const data: RefreshResponse = await response.json();
	await storeTokens(data.token, refreshTokenValue);
	return data.token;
}

export async function isAuthenticated(): Promise<boolean> {
	const token = await getToken();
	return token !== null;
}

export async function getProfile(): Promise<UserProfile> {
	const { data } = await apiClient<UserProfile>("/api/users/me");
	return data;
}
