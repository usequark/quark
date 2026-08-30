/**
 * Push Notification Job Handler
 * Sends push notifications via APNs (iOS) and FCM (Android) directly.
 * No Firebase SDK — uses HTTP APIs with service account credentials from env.
 */

import { AppError, ValidationError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { importPKCS8, SignJWT } from "jose";

const APNS_KEY = process.env.APNS_KEY;
const APNS_KEY_ID = process.env.APNS_KEY_ID;
const APNS_TEAM_ID = process.env.APNS_TEAM_ID;
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID;
const APNS_USE_SANDBOX = process.env.APNS_USE_SANDBOX !== "false";

const GCP_SERVICE_ACCOUNT = process.env.GCP_SERVICE_ACCOUNT;

/**
 * Job handler for SEND_PUSH_NOTIFICATION
 * @param {import("bullmq").Job} bullJob
 * @param {import("@techstream/quark-core").Logger} logger
 */
export async function handleSendPushNotification(bullJob, logger) {
	const { userId, title, body: notificationBody, data } = bullJob.data;

	if (!userId || !title || !notificationBody) {
		throw new ValidationError("Missing required fields: userId, title, body");
	}

	// Fetch all devices for the user
	const devices = await prisma.device.findMany({
		where: { userId },
		select: { pushToken: true, platform: true },
	});

	if (devices.length === 0) {
		logger.warn("No devices found for user", { userId });
		return { success: true, sent: 0, failed: 0 };
	}

	let sent = 0;
	let failed = 0;

	for (const device of devices) {
		try {
			if (device.platform === "ios") {
				await sendAPNs(device.pushToken, title, notificationBody, data);
				sent++;
			} else if (device.platform === "android") {
				await sendFCM(device.pushToken, title, notificationBody, data);
				sent++;
			}
		} catch (error) {
			logger.error("Failed to send push notification", {
				error: error.message,
				platform: device.platform,
				token: device.pushToken.slice(0, 10),
			});
			failed++;
		}
	}

	logger.info("Push notification batch complete", {
		userId,
		sent,
		failed,
		total: devices.length,
	});

	return { success: true, sent, failed };
}

/**
 * Generate APNs JWT token for authentication.
 */
async function generateAPNsToken() {
	if (!APNS_KEY || !APNS_KEY_ID || !APNS_TEAM_ID) {
		throw new AppError(
			"APNs credentials not configured (APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID)",
			500,
			"APNS_NOT_CONFIGURED",
		);
	}

	const privateKey = await importPKCS8(APNS_KEY, "ES256");
	const now = Math.floor(Date.now() / 1000);

	return new SignJWT({})
		.setProtectedHeader({ alg: "ES256", kid: APNS_KEY_ID })
		.setIssuedAt(now)
		.setExpirationTime("1h")
		.setIssuer(APNS_TEAM_ID)
		.sign(privateKey);
}

/**
 * Send push notification via Apple Push Notification service (HTTP/2).
 */
async function sendAPNs(token, title, body, data = {}) {
	if (!APNS_KEY) {
		throw new AppError("APNs not configured", 500, "APNS_NOT_CONFIGURED");
	}

	const jwt = await generateAPNsToken();
	const host = APNS_USE_SANDBOX
		? "api.sandbox.push.apple.com"
		: "api.push.apple.com";

	const payload = {
		aps: {
			alert: { title, body },
			sound: "default",
			"content-available": 1,
		},
		...data,
	};

	const response = await fetch(`https://${host}/3/device/${token}`, {
		method: "POST",
		headers: {
			authorization: `bearer ${jwt}`,
			"apns-topic": APNS_BUNDLE_ID || "",
			"apns-push-type": "alert",
			"apns-priority": "10",
			"content-type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new AppError(
			`APNs error ${response.status}: ${errorBody}`,
			502,
			"APNS_ERROR",
		);
	}
}

/**
 * Get a short-lived OAuth2 access token for FCM from a GCP service account.
 */
async function getFCMAccessToken() {
	if (!GCP_SERVICE_ACCOUNT) {
		throw new AppError(
			"GCP_SERVICE_ACCOUNT not configured",
			500,
			"FCM_NOT_CONFIGURED",
		);
	}

	const serviceAccount = JSON.parse(GCP_SERVICE_ACCOUNT);
	const now = Math.floor(Date.now() / 1000);

	const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");

	const jwt = await new SignJWT({
		scope: "https://www.googleapis.com/auth/firebase.messaging",
	})
		.setProtectedHeader({ alg: "RS256", kid: serviceAccount.private_key_id })
		.setIssuedAt(now)
		.setExpirationTime("1h")
		.setIssuer(serviceAccount.client_email)
		.setSubject(serviceAccount.client_email)
		.audience("https://oauth2.googleapis.com/token")
		.sign(privateKey);

	const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: jwt,
		}),
	});

	if (!tokenResponse.ok) {
		const error = await tokenResponse.text();
		throw new AppError(
			`FCM token exchange failed: ${error}`,
			502,
			"FCM_TOKEN_EXCHANGE_FAILED",
		);
	}

	const { access_token } = await tokenResponse.json();
	return access_token;
}

/**
 * Send push notification via Firebase Cloud Messaging HTTP v1 API.
 */
async function sendFCM(token, title, body, data = {}) {
	const accessToken = await getFCMAccessToken();

	const projectId = JSON.parse(GCP_SERVICE_ACCOUNT || "{}").project_id;
	if (!projectId) {
		throw new AppError(
			"GCP project_id not found in service account",
			500,
			"FCM_NOT_CONFIGURED",
		);
	}

	const message = {
		token,
		notification: { title, body },
		data: Object.fromEntries(
			Object.entries(data).map(([k, v]) => [k, String(v)]),
		),
	};

	const response = await fetch(
		`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${accessToken}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ message }),
		},
	);

	if (!response.ok) {
		const errorBody = await response.text();
		throw new AppError(
			`FCM error ${response.status}: ${errorBody}`,
			502,
			"FCM_ERROR",
		);
	}
}
