import {
	makeRedirectUri,
	ResponseType,
	useAuthRequest,
} from "expo-auth-session";
import { useEffect } from "react";
import { getConfig } from "./config";
import { storeTokens } from "./storage";

interface SocialAuthResponse {
	token: string;
	refreshToken: string;
	expiresAt: string;
}

const discovery = {
	authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
	tokenEndpoint: "https://oauth2.googleapis.com/token",
	revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

/**
 * Hook-based Google Sign-In using expo-auth-session.
 * Returns the request function and any error.
 */
export function useGoogleAuth() {
	const config = getConfig();
	const redirectUri = makeRedirectUri({
		scheme: config.apiUrl.replace(/^https?:\/\//, "").split("/")[0],
		path: "google",
	});

	const [request, response, promptAsync] = useAuthRequest(
		{
			clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "",
			redirectUri,
			responseType: ResponseType.IdToken,
			scopes: ["openid", "profile", "email"],
		},
		discovery,
	);

	useEffect(() => {
		if (response?.type === "success") {
			const { id_token } = response.params;
			exchangeGoogleToken(id_token).catch(() => {});
		}
	}, [response]);

	return { request, promptAsync };
}

async function exchangeGoogleToken(idToken: string): Promise<void> {
	const config = getConfig();
	const response = await fetch(`${config.apiUrl}/api/auth/google`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ idToken }),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => null);
		throw new Error(error?.message || "Google authentication failed");
	}

	const data: SocialAuthResponse = await response.json();
	await storeTokens(data.token, data.refreshToken);
}
