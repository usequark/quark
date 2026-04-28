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
		},
		Post: {
			label: "Blog Posts",
			slugSource: "title",
			excerptField: "excerpt",
			hasCoverImage: true,
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
