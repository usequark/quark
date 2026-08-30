import { useCallback, useEffect, useState } from "react";
import { configureNotificationHandler, registerDevice, registerForPushNotifications } from "../lib/notifications";
import { isAuthenticated as checkAuth, signIn as authSignIn, signOut as authSignOut } from "../lib/auth";

interface AuthState {
	isAuthenticated: boolean;
	isLoading: boolean;
	signIn: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
	registerPushToken: () => Promise<void>;
}

let authStateListeners: Array<() => void> = [];
let globalAuthState: AuthState = {
	isAuthenticated: false,
	isLoading: true,
	signIn: async () => {},
	signOut: async () => {},
	registerPushToken: async () => {},
};

function notifyListeners() {
	for (const listener of authStateListeners) {
		listener();
	}
}

/**
 * Initialize auth state on app launch.
 */
export function useAuthInit() {
	const [state, setState] = useState<AuthState>(globalAuthState);

	useEffect(() => {
		configureNotificationHandler();

		(async () => {
			try {
				const authenticated = await checkAuth();
				globalAuthState = {
					...globalAuthState,
					isAuthenticated: authenticated,
					isLoading: false,
				};
				notifyListeners();
			} catch {
				globalAuthState = {
					...globalAuthState,
					isAuthenticated: false,
					isLoading: false,
				};
				notifyListeners();
			}
		})();

		const listener = () => {
			setState({ ...globalAuthState });
		};
		authStateListeners.push(listener);

		return () => {
			authStateListeners = authStateListeners.filter((l) => l !== listener);
		};
	}, []);
}

/**
 * Hook to access auth state and actions.
 */
export function useAuth(): AuthState {
	const [state, setState] = useState<AuthState>(globalAuthState);

	useEffect(() => {
		setState({ ...globalAuthState });
		const listener = () => setState({ ...globalAuthState });
		authStateListeners.push(listener);
		return () => {
			authStateListeners = authStateListeners.filter((l) => l !== listener);
		};
	}, []);

	const signIn = useCallback(async (email: string, password: string) => {
		await authSignIn(email, password);
		globalAuthState = { ...globalAuthState, isAuthenticated: true, isLoading: false };
		notifyListeners();
	}, []);

	const signOut = useCallback(async () => {
		await authSignOut();
		globalAuthState = { ...globalAuthState, isAuthenticated: false, isLoading: false };
		notifyListeners();
	}, []);

	const registerPushToken = useCallback(async () => {
		try {
			const token = await registerForPushNotifications();
			if (token) {
				await registerDevice(token);
			}
		} catch {
			// Non-critical - don't block auth flow
		}
	}, []);

	return {
		...state,
		signIn,
		signOut,
		registerPushToken,
	};
}
