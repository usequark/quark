import { ApiError } from "./errors";

export function getConfig() {
	const apiUrl = process.env.EXPO_PUBLIC_API_URL;
	if (!apiUrl) {
		throw new ApiError({
			name: "ConfigError",
			message: "EXPO_PUBLIC_API_URL is not set. Add it to your .env file.",
			code: "MISSING_CONFIG",
			statusCode: 500,
		});
	}
	return { apiUrl };
}
