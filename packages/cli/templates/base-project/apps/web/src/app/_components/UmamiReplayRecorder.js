"use client";

import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useRef } from "react";
import { getUmamiUserRole } from "../../lib/analytics/umami.js";
import { getUmamiConfig } from "../../lib/analytics/umami-config.js";
import {
	buildReplayEndpoint,
	createReplayBuffer,
	getReplayMaskConfig,
	postReplayBatch,
	shouldSampleReplay,
	UMAMI_REPLAY_DEFAULTS,
	waitForUmamiSessionCache,
} from "../../lib/analytics/umami-replay.js";

const RRWEB_OPTIONS = {
	inlineStylesheet: true,
	slimDOMOptions: {
		script: true,
		comment: true,
		headMetaDescKeywords: true,
		headMetaSocial: true,
		headMetaRobots: true,
		headMetaHttpEquiv: true,
		headMetaAuthorship: true,
		headMetaVerification: true,
	},
	recordCanvas: false,
	recordCrossOriginIframes: false,
	checkoutEveryNms: 30000,
};

export default function UmamiReplayRecorder() {
	const pathname = usePathname();
	const previousPathnameRef = useRef(pathname);
	const bufferRef = useRef(createReplayBuffer());
	const cacheRef = useRef("");
	const endpointRef = useRef("");
	const websiteIdRef = useRef("");
	const startedAtRef = useRef(0);
	const isActiveRef = useRef(false);
	const recordRef = useRef(null);

	const flushPendingEvents = useEffectEvent(
		async ({ useKeepalive = false } = {}) => {
			const events = bufferRef.current.drain();
			if (!events.length) return false;

			const sent = await postReplayBatch({
				endpoint: endpointRef.current,
				cache: cacheRef.current,
				websiteId: websiteIdRef.current,
				events,
				useKeepalive,
			});

			if (!sent) {
				bufferRef.current.restore(events);
			}

			return sent;
		},
	);

	useEffect(() => {
		const umamiConfig = getUmamiConfig();
		if (!umamiConfig.replayEnabled || !shouldSampleReplay()) {
			return undefined;
		}

		// Skip replay recording for admin users (identified by the
		// umami_user_role cookie set by the admin layout).
		const role = getUmamiUserRole();
		if (role === "admin" || role === "client_admin") return undefined;

		let cancelled = false;
		let flushIntervalId = null;
		let stopRecording = () => {};
		let removeVisibilityListener = () => {};
		let removePageHideListener = () => {};

		async function setupReplay() {
			const cache = await waitForUmamiSessionCache();
			if (cancelled || !cache) return;

			const { record } = await import("rrweb");
			if (cancelled) return;

			cacheRef.current = cache;
			endpointRef.current = buildReplayEndpoint(umamiConfig.url);
			websiteIdRef.current = umamiConfig.websiteId;
			startedAtRef.current = Date.now();

			const stopRrweb = record({
				emit(event) {
					if (
						Date.now() - startedAtRef.current >
						UMAMI_REPLAY_DEFAULTS.maxDurationMs
					) {
						stopRecording();
						return;
					}

					const eventCount = bufferRef.current.push(event);
					if (eventCount >= UMAMI_REPLAY_DEFAULTS.flushEventCount) {
						void flushPendingEvents();
					}
				},
				...getReplayMaskConfig(),
				...RRWEB_OPTIONS,
				...(UMAMI_REPLAY_DEFAULTS.blockSelector
					? { blockSelector: UMAMI_REPLAY_DEFAULTS.blockSelector }
					: {}),
			});

			recordRef.current = record;
			isActiveRef.current = true;
			flushIntervalId = window.setInterval(() => {
				void flushPendingEvents();
			}, UMAMI_REPLAY_DEFAULTS.flushIntervalMs);

			const handleVisibilityChange = () => {
				if (document.visibilityState === "hidden") {
					void flushPendingEvents({ useKeepalive: true });
				}
			};
			const handlePageHide = () => {
				void flushPendingEvents({ useKeepalive: true });
			};

			document.addEventListener("visibilitychange", handleVisibilityChange);
			window.addEventListener("pagehide", handlePageHide);

			removeVisibilityListener = () => {
				document.removeEventListener(
					"visibilitychange",
					handleVisibilityChange,
				);
			};
			removePageHideListener = () => {
				window.removeEventListener("pagehide", handlePageHide);
			};

			stopRecording = ({ useKeepalive = false } = {}) => {
				if (!isActiveRef.current) return;

				isActiveRef.current = false;
				if (flushIntervalId) {
					clearInterval(flushIntervalId);
					flushIntervalId = null;
				}

				removeVisibilityListener();
				removePageHideListener();
				stopRrweb();
				recordRef.current = null;
				void flushPendingEvents({ useKeepalive });
			};
		}

		void setupReplay();

		return () => {
			cancelled = true;
			stopRecording({ useKeepalive: true });
		};
	}, []);

	useEffect(() => {
		if (previousPathnameRef.current === pathname) return;

		previousPathnameRef.current = pathname;
		if (!isActiveRef.current || !recordRef.current) return;

		void flushPendingEvents();
		recordRef.current.takeFullSnapshot?.(true);
	}, [pathname]);

	return null;
}
