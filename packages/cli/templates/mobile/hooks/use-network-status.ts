import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

interface NetworkStatus {
	isOnline: boolean;
	isOffline: boolean;
}

/**
 * Hook that tracks network connectivity status.
 * Uses @react-native-community/netinfo.
 */
export function useNetworkStatus(): NetworkStatus {
	const [status, setStatus] = useState<NetworkStatus>({
		isOnline: true,
		isOffline: false,
	});

	useEffect(() => {
		const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
			const online = Boolean(state.isConnected && state.isInternetReachable);
			setStatus({ isOnline: online, isOffline: !online });
		});

		return () => unsubscribe();
	}, []);

	return status;
}
