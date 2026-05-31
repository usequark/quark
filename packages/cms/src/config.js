export const cmsConfig = {
	/**
	 * Content types managed by the CMS.
	 * Key: Prisma model name. Value: display config.
	 * Only models listed here appear in the CMS sidebar section.
	 */
	contentTypes: {
		Page: {
			label: "Pages",
			slugSource: "title",
			excerptField: "excerpt",
			// Page is the only default public-content route in Quark. Keep the
			// base CMS package page-first, and let dedicated CLI packages introduce
			// richer vertical routes when a project explicitly needs them.
			publicRoute: {
				pathPrefix: "",
				sitemap: {
					changeFrequency: "weekly",
					priority: 0.8,
				},
			},
		},
	},

	/** Media library configuration */
	media: {
		/** Max upload size in bytes (default: 10MB) */
		maxFileSize: 10 * 1024 * 1024,
		/** Allowed MIME types */
		allowedTypes: [
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
			"image/avif",
			"image/svg+xml",
			"application/pdf",
		],
	},
};
