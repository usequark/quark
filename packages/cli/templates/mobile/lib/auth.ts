import { apiClient } from "./api-client";
import { getConfig } from "./config";
import { ApiError } from "./errors";
import { clearTokens, getToken, storeTokens } from "./storage";

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
		throw new ApiError({
			name: "AuthError",
			message: error?.message || "Invalid credentials",
			code: "INVALID_CREDENTIALS",
			statusCode: 401,
		});
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
	if (!refreshTokenValue)
		throw new ApiError({
			name: "AuthError",
			message: "No refresh token available",
			code: "NO_REFRESH_TOKEN",
			statusCode: 401,
		});

	const config = getConfig();
	const response = await fetch(`${config.apiUrl}/api/auth/refresh`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ refreshToken: refreshTokenValue }),
	});

	if (!response.ok) {
		await clearTokens();
		throw new ApiError({
			name: "AuthError",
			message: "Token refresh failed",
			code: "TOKEN_REFRESH_FAILED",
			statusCode: 401,
		});
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
