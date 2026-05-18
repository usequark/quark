import { getUmamiConfig } from "./umami-config.js";

function getUmamiClient() {
	if (typeof window === "undefined") return null;
	if (!getUmamiConfig().enabled) return null;
	return window.umami ?? null;
}

export function isUmamiEnabled(env = process.env) {
	return getUmamiConfig(env).enabled;
}

export function track(name, data) {
	const umami = getUmamiClient();
	if (!umami?.track) return false;

	if (typeof name === "string") {
		umami.track(name, data);
		return true;
	}

	if (name && typeof name === "object") {
		umami.track(name);
		return true;
	}

	return false;
}

export function identify(data) {
	const umami = getUmamiClient();
	if (!umami?.identify) return false;

	umami.identify(data);
	return true;
}

export function trackRevenue(amount, currency = "USD", data = {}) {
	if (typeof amount !== "number" || Number.isNaN(amount)) return false;
	return track("revenue", { revenue: amount, currency, ...data });
}
