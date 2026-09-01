import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { getConfig } from "./config";
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
		throw new Error("Apple Sign In is not available on this device");
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
		throw new Error("Apple Sign In failed: no identity token");
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
		throw new Error(error?.message || "Apple authentication failed");
	}

	const data: SocialAuthResponse = await response.json();
	await storeTokens(data.token, data.refreshToken);
}
