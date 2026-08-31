import { getConfig } from "./config";
import { ApiError, type AppClientError } from "./errors";
import { clearTokens, getRefreshToken, getToken, storeTokens } from "./storage";

interface ApiResponse<T = unknown> {
	data: T;
	status: number;
}

interface FetchOptions extends RequestInit {
	timeout?: number;
}

const DEFAULT_TIMEOUT = 15000;

/**
 * Injects Bearer token from SecureStore, handles 401 with refresh + retry.
 */
export async function apiClient<T = unknown>(
	path: string,
	options: FetchOptions = {},
): Promise<ApiResponse<T>> {
	const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
	const config = getConfig();

	const headers = new Headers(fetchOptions.headers);
	const token = await getToken();
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	if (!headers.has("Content-Type") && fetchOptions.body) {
		headers.set("Content-Type", "application/json");
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(`${config.apiUrl}${path}`, {
			...fetchOptions,
			headers,
			signal: controller.signal,
		});

		clearTimeout(timer);

		if (response.status === 401 && token) {
			const refreshed = await attemptTokenRefresh();
			if (refreshed) {
				const retryHeaders = new Headers(headers);
				retryHeaders.set("Authorization", `Bearer ${refreshed}`);
				const retryResponse = await fetch(`${config.apiUrl}${path}`, {
					...fetchOptions,
					headers: retryHeaders,
					signal: controller.signal,
				});
				return parseResponse<T>(retryResponse);
			}
			await clearTokens();
			throw buildError({
				name: "UnauthorizedError",
				message: "Session expired",
				code: "UNAUTHORIZED",
				statusCode: 401,
			});
		}

		return parseResponse<T>(response);
	} catch (error) {
		clearTimeout(timer);
		if (error instanceof ApiError) throw error;
		if (error instanceof DOMException && error.name === "AbortError") {
			throw buildError({
				name: "TimeoutError",
				message: "Request timed out",
				code: "TIMEOUT",
				statusCode: 408,
			});
		}
		throw buildError({
			name: "NetworkError",
			message: error instanceof Error ? error.message : "Network error",
			code: "NETWORK_ERROR",
			statusCode: 0,
		});
	}
}

async function attemptTokenRefresh(): Promise<string | null> {
	try {
		const refreshToken = await getRefreshToken();
		if (!refreshToken) return null;

		const config = getConfig();
		const response = await fetch(`${config.apiUrl}/api/auth/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken }),
		});

		if (!response.ok) return null;

		const data = await response.json();
		await storeTokens(data.token, refreshToken);
		return data.token;
	} catch {
		return null;
	}
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
	const text = await response.text();
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		data = text;
	}

	if (!response.ok) {
		const errorData = data as Partial<AppClientError>;
		throw buildError({
			name: errorData.name || "ApiError",
			message:
				errorData.message || `Request failed with status ${response.status}`,
			code: errorData.code || "UNKNOWN_ERROR",
			statusCode: response.status,
			details: errorData.details,
			retryAfter: errorData.retryAfter,
		});
	}

	return { data: data as T, status: response.status };
}

function buildError(params: AppClientError): ApiError {
	return new ApiError(params);
}
