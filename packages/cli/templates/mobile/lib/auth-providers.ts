import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { getConfig } from "./config";
import { ApiError } from "./errors";
import { storeTokens } from "./storage";

interface SocialAuthResponse {
	token: string;
	refreshToken: string;
	expiresAt: string;
}

/**
 * Sign in with Apple.
 * Gets an identity token from Apple, sends it to the backend,
 * receives a custom JWT, and stores it.
 */
export async function signInWithApple(): Promise<void> {
	const isAvailable = await AppleAuthentication.isAvailableAsync();
	if (!isAvailable) {
		throw new ApiError({
			name: "AuthError",
			message: "Apple Sign In is not available on this device",
			code: "APPLE_UNAVAILABLE",
			statusCode: 400,
		});
	}

	const nonce = Crypto.randomUUID();
	const digest = await Crypto.digestStringAsync(
		Crypto.CryptoDigestAlgorithm.SHA256,
		nonce,
	);

	const credential = await AppleAuthentication.signInAsync({
		requestedScopes: [
			AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
			AppleAuthentication.AppleAuthenticationScope.EMAIL,
		],
		nonce: digest,
	});

	if (!credential.identityToken) {
		throw new ApiError({
			name: "AuthError",
			message: "Apple Sign In failed: no identity token received",
			code: "APPLE_NO_TOKEN",
			statusCode: 400,
		});
	}

	const config = getConfig();
	const response = await fetch(`${config.apiUrl}/api/auth/apple`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			identityToken: credential.identityToken,
			nonce,
		}),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => null);
		throw new ApiError({
			name: "AuthError",
			message: error?.message || "Apple authentication failed",
			code: "APPLE_AUTH_FAILED",
			statusCode: 401,
		});
	}

	const data: SocialAuthResponse = await response.json();
	await storeTokens(data.token, data.refreshToken);
}
