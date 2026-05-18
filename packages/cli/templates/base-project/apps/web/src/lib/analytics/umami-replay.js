import { getUmamiConfig, normalizeUmamiUrl } from "./umami-config.js";

export const UMAMI_REPLAY_DEFAULTS = Object.freeze({
	sampleRate: 0.15,
	flushIntervalMs: 10000,
	flushEventCount: 100,
	maxDurationMs: 300000,
	sessionPollIntervalMs: 100,
	sessionPollAttempts: 50,
	maskLevel: "moderate",
	blockSelector: "[data-umami-block]",
});

export function shouldSampleReplay(
	randomValue = Math.random(),
	sampleRate = UMAMI_REPLAY_DEFAULTS.sampleRate,
) {
	if (sampleRate >= 1) return true;
	if (sampleRate <= 0) return false;
	return randomValue <= sampleRate;
}

export function getReplayMaskConfig(
	maskLevel = UMAMI_REPLAY_DEFAULTS.maskLevel,
) {
	if (maskLevel === "strict") {
		return {
			maskAllInputs: true,
			maskTextSelector: "*",
		};
	}

	return {
		maskAllInputs: true,
	};
}

export function createReplayBuffer() {
	let events = [];

	return {
		push(event) {
			events.push(event);
			return events.length;
		},
		drain() {
			const drained = events;
			events = [];
			return drained;
		},
		restore(drainedEvents) {
			if (!Array.isArray(drainedEvents) || !drainedEvents.length)
				return events.length;
			events = [...drainedEvents, ...events];
			return events.length;
		},
		size() {
			return events.length;
		},
	};
}

export function buildReplayEndpoint(env = process.env) {
	const url =
		typeof env === "string" ? normalizeUmamiUrl(env) : getUmamiConfig(env).url;

	return url ? `${url}/api/record` : "";
}

export function getUmamiSessionCache(umami = globalThis.window?.umami) {
	const session = umami?.getSession?.();
	return session?.cache || "";
}

export function resolveUmamiSessionCache({
	cache = "",
	getUmami = () => globalThis.window?.umami,
} = {}) {
	return getUmamiSessionCache(getUmami()) || cache;
}

export function waitForUmamiSessionCache({
	getUmami = () => globalThis.window?.umami,
	pollIntervalMs = UMAMI_REPLAY_DEFAULTS.sessionPollIntervalMs,
	maxAttempts = UMAMI_REPLAY_DEFAULTS.sessionPollAttempts,
} = {}) {
	return new Promise((resolve) => {
		const poll = (attempts = 0) => {
			const cache = getUmamiSessionCache(getUmami());
			if (cache) {
				resolve(cache);
				return;
			}

			if (attempts >= maxAttempts) {
				resolve("");
				return;
			}

			setTimeout(() => poll(attempts + 1), pollIntervalMs);
		};

		poll();
	});
}

export function buildReplayBody({ websiteId, events, timestamp }) {
	return JSON.stringify({
		type: "record",
		payload: {
			website: websiteId,
			events,
			timestamp,
		},
	});
}

export async function postReplayBatch({
	endpoint,
	cache,
	websiteId,
	events,
	timestamp = Math.floor(Date.now() / 1000),
	useKeepalive = false,
	getUmami = () => globalThis.window?.umami,
	fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
	const sessionCache = resolveUmamiSessionCache({ cache, getUmami });

	if (
		!endpoint ||
		!sessionCache ||
		!websiteId ||
		!events?.length ||
		!fetchImpl
	) {
		return false;
	}

	const body = buildReplayBody({ websiteId, events, timestamp });
	const keepalive = useKeepalive && body.length < 60000;

	try {
		const response = await fetchImpl(endpoint, {
			keepalive,
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/json",
				"x-umami-cache": sessionCache,
			},
			credentials: "omit",
		});

		return response?.ok === true;
	} catch {
		return false;
	}
}
