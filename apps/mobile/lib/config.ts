const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
	throw new Error("EXPO_PUBLIC_API_URL is not set. Add it to your .env file.");
}

export function getConfig() {
	return {
		apiUrl: API_URL,
	};
}
