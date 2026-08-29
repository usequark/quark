import createNextPwa from "@ducanh2912/next-pwa";

/**
 * PWA configuration wrapper.
 * Only active when PWA_ENABLED is set or this config is used directly.
 * Import and spread into your next.config.js when PWA is enabled.
 */
const withPwa = createNextPwa({
	dest: "public",
	disable: process.env.NODE_ENV !== "production",
	register: true,
	skipWaiting: true,
	runtimeCaching: [
		{
			urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
			handler: "CacheFirst",
			options: {
				cacheName: "google-fonts",
				expiration: {
					maxEntries: 10,
					maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
				},
			},
		},
		{
			urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
			handler: "CacheFirst",
			options: {
				cacheName: "images",
				expiration: {
					maxEntries: 50,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				},
			},
		},
		{
			urlPattern: /\/_next\/static\/.*/i,
			handler: "CacheFirst",
			options: {
				cacheName: "next-static",
				expiration: {
					maxEntries: 100,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				},
			},
		},
	],
});

export default withPwa;
