import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";

export async function storeTokens(
	token: string,
	refreshToken: string,
): Promise<void> {
	await SecureStore.setItemAsync(TOKEN_KEY, token);
	await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getToken(): Promise<string | null> {
	return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
	return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
	await SecureStore.deleteItemAsync(TOKEN_KEY);
	await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
