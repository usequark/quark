export const AUTH_PROVIDER_LOAD_ERROR =
	"Third-party sign-in is temporarily unavailable.";

export async function loadAuthProviders(fetchImpl = fetch) {
	try {
		const response = await fetchImpl("/api/auth/providers");

		if (!response.ok) {
			return {
				providers: null,
				error: AUTH_PROVIDER_LOAD_ERROR,
			};
		}

		return {
			providers: await response.json(),
			error: "",
		};
	} catch {
		return {
			providers: null,
			error: AUTH_PROVIDER_LOAD_ERROR,
		};
	}
}
