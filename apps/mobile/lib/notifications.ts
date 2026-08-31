import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiClient } from "./api-client";

/**
 * Register the device push token with the backend.
 * Must be called after authentication.
 */
export async function registerForPushNotifications(): Promise<string | null> {
	if (!Device.isDevice) {
		return null;
	}

	const { status: existingStatus } = await Notifications.getPermissionsAsync();
	let finalStatus = existingStatus;

	if (existingStatus !== "granted") {
		const { status } = await Notifications.requestPermissionsAsync();
		finalStatus = status;
	}

	if (finalStatus !== "granted") {
		return null;
	}

	const tokenData = await Notifications.getExpoPushTokenAsync();
	const pushToken = tokenData.data;

	if (Platform.OS === "android") {
		Notifications.setNotificationChannelAsync("default", {
			name: "default",
			importance: Notifications.AndroidImportance.MAX,
			vibrationPattern: [0, 250, 250, 250],
			lightColor: "#FF231F7C",
		});
	}

	return pushToken;
}

/**
 * Send the push token to the backend for storage.
 */
export async function registerDevice(pushToken: string): Promise<void> {
	const { Platform: PlatformModule } = await import("react-native");
	const Constants = await import("expo-constants");
	const deviceId =
		Constants.default?.installationId ||
		Constants.default?.expoConfig?.extra?.eas?.projectId ||
		"unknown";

	await apiClient("/api/device/register", {
		method: "POST",
		body: JSON.stringify({
			platform: PlatformModule.OS,
			pushToken,
			deviceId,
		}),
	});
}

/**
 * Configure foreground notification handling.
 */
export function configureNotificationHandler() {
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowAlert: true,
			shouldPlaySound: true,
			shouldSetBadge: false,
		}),
	});
}
