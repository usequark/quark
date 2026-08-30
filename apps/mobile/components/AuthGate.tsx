import { useEffect, type ReactNode } from "react";
import { useAuth } from "../hooks/use-auth";

interface AuthGateProps {
	children: ReactNode;
}

/**
 * Wraps authenticated screens and ensures push token is registered.
 */
export function AuthGate({ children }: AuthGateProps) {
	const { registerPushToken } = useAuth();

	useEffect(() => {
		registerPushToken();
	}, [registerPushToken]);

	return <>{children}</>;
}
