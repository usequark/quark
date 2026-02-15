/**
 * @techstream/quark-core - File Validation
 *
 * Validates uploaded files: size limits, MIME type allow-lists,
 * and magic-byte verification to prevent MIME spoofing.
 */

// ---------------------------------------------------------------------------
// Magic bytes for common file types
// ---------------------------------------------------------------------------

const MAGIC_BYTES = [
	// Images
	{ mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
	{ mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
	{ mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
	{
		mime: "image/webp",
		bytes: [0x52, 0x49, 0x46, 0x46],
		offset: 0,
		extra: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
	},
	{
		mime: "image/svg+xml",
		bytes: null,
		detect: (buf) => {
			const head = buf.subarray(0, 256).toString("utf8").trimStart();
			return head.startsWith("<svg") || head.startsWith("<?xml");
		},
	},
	{
		mime: "image/avif",
		bytes: null,
		detect: (buf) => {
			// ftyp box with "avif" or "avis" brand
			if (buf.length < 12) return false;
			const ftyp = buf.subarray(4, 8).toString("ascii");
			if (ftyp !== "ftyp") return false;
			const brand = buf.subarray(8, 12).toString("ascii");
			return brand === "avif" || brand === "avis";
		},
	},

	// Documents
	{ mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
	{ mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },

	// Video — MP4 uses ftyp box like AVIF, but with different brands (isom, mp41, mp42, etc.)
	{
		mime: "video/mp4",
		bytes: null,
		detect: (buf) => {
			if (buf.length < 12) return false;
			const ftyp = buf.subarray(4, 8).toString("ascii");
			if (ftyp !== "ftyp") return false;
			// Exclude AVIF brands already handled above
			const brand = buf.subarray(8, 12).toString("ascii");
			if (brand === "avif" || brand === "avis") return false;
			return true;
		},
	},
	{ mime: "video/webm", bytes: [0x1a, 0x45, 0xdf, 0xa3] },
];

/**
 * Detect MIME type from file buffer using magic bytes.
 * Returns null if no match found.
 * @param {Buffer} buffer - At least the first 256 bytes of the file
 * @returns {string | null}
 */
export function detectMimeType(buffer) {
	for (const entry of MAGIC_BYTES) {
		if (entry.detect) {
			if (entry.detect(buffer)) return entry.mime;
			continue;
		}

		if (!entry.bytes) continue;

		const offset = entry.offset || 0;
		let match = true;
		for (let i = 0; i < entry.bytes.length; i++) {
			if (buffer[offset + i] !== entry.bytes[i]) {
				match = false;
				break;
			}
		}

		if (match && entry.extra) {
			for (let i = 0; i < entry.extra.bytes.length; i++) {
				if (buffer[entry.extra.offset + i] !== entry.extra.bytes[i]) {
					match = false;
					break;
				}
			}
		}

		if (match) return entry.mime;
	}

	return null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const DEFAULT_ALLOWED_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/svg+xml",
	"application/pdf",
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FileValidationOptions
 * @property {number} [maxSize] - Max file size in bytes (default: 10MB)
 * @property {string[]} [allowedTypes] - Allowed MIME types. Supports wildcards like "image/*"
 * @property {boolean} [verifyMagicBytes=true] - Check magic bytes match declared MIME type
 */

/**
 * @typedef {Object} FileValidationResult
 * @property {boolean} valid
 * @property {string} [error] - Human-readable error message (when invalid)
 * @property {string} [detectedType] - MIME type detected from magic bytes
 */

/**
 * Validate a file against size, type and magic-byte rules.
 *
 * @param {Object} file
 * @param {string} file.filename - Original filename
 * @param {string} file.mimeType - Declared MIME type (from Content-Type)
 * @param {number} file.size - File size in bytes
 * @param {Buffer} [file.buffer] - File content (required if verifyMagicBytes is true)
 * @param {FileValidationOptions} [options]
 * @returns {FileValidationResult}
 */
export function validateFile(file, options = {}) {
	const {
		maxSize = parseMaxSize(),
		allowedTypes = parseAllowedTypes(),
		verifyMagicBytes = true,
	} = options;

	// Size check
	if (file.size > maxSize) {
		return {
			valid: false,
			error: `File exceeds maximum size of ${formatBytes(maxSize)} (got ${formatBytes(file.size)})`,
		};
	}

	// MIME type allow-list
	if (!isTypeAllowed(file.mimeType, allowedTypes)) {
		return {
			valid: false,
			error: `File type "${file.mimeType}" is not allowed. Allowed: ${allowedTypes.join(", ")}`,
		};
	}

	// Magic byte verification
	if (verifyMagicBytes && file.buffer) {
		const detected = detectMimeType(file.buffer);
		if (detected && !isSameCategory(detected, file.mimeType)) {
			return {
				valid: false,
				error: `File content does not match declared type. Declared: ${file.mimeType}, detected: ${detected}`,
				detectedType: detected,
			};
		}
		return { valid: true, detectedType: detected };
	}

	return { valid: true };
}

/**
 * Check if a MIME type matches an allow list (supports wildcards like "image/*").
 * @param {string} mimeType
 * @param {string[]} allowedTypes
 * @returns {boolean}
 */
export function isTypeAllowed(mimeType, allowedTypes) {
	if (!mimeType) return false;
	const normalized = mimeType.toLowerCase().trim();

	for (const pattern of allowedTypes) {
		const p = pattern.toLowerCase().trim();
		if (p === normalized) return true;
		if (p === "*/*") return true;
		if (p.endsWith("/*")) {
			const category = p.slice(0, p.indexOf("/"));
			if (normalized.startsWith(`${category}/`)) return true;
		}
	}

	return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMaxSize() {
	const env = process.env.UPLOAD_MAX_SIZE;
	if (!env) return DEFAULT_MAX_SIZE;
	const n = Number(env);
	return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_SIZE;
}

function parseAllowedTypes() {
	const env = process.env.UPLOAD_ALLOWED_TYPES;
	if (!env) return DEFAULT_ALLOWED_TYPES;
	return env
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if two MIME types belong to the same top-level category.
 * e.g. "image/jpeg" and "image/png" → true
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isSameCategory(a, b) {
	if (!a || !b) return true; // lenient when one side is unknown
	const catA = a.split("/")[0];
	const catB = b.split("/")[0];
	return catA === catB;
}
