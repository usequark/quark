const CACHE_NAME = "quark-v1";

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
			),
		),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	const { request } = event;

	// Never cache API routes, auth, or non-GET requests
	if (
		request.method !== "GET" ||
		request.url.includes("/api/") ||
		request.url.includes("/auth/")
	) {
		return;
	}

	// Navigation requests: network first, fall back to cache
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
					return response;
				})
				.catch(() => caches.match(request)),
		);
		return;
	}

	// Static assets (Next.js chunks, images, fonts): cache first
	if (
		request.url.includes("/_next/static/") ||
		/\.(png|jpg|jpeg|svg|gif|webp|avif|woff|woff2|ico)$/.test(request.url)
	) {
		event.respondWith(
			caches.match(request).then((cached) => {
				if (cached) return cached;
				return fetch(request).then((response) => {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
					return response;
				});
			}),
		);
		return;
	}

	// Everything else: network first
	event.respondWith(
		fetch(request)
			.then((response) => {
				const clone = response.clone();
				caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
				return response;
			})
			.catch(() => caches.match(request)),
	);
});
