const DEFAULT_LOCALE_FALLBACK = "en";
const SUPPORTED_LOCALES_FALLBACK = ["en"];

export function getDefaultLocale() {
	const env = process.env.DEFAULT_LOCALE;
	return env?.trim() ? env.trim() : DEFAULT_LOCALE_FALLBACK;
}

export function getSupportedLocales() {
	const env = process.env.SUPPORTED_LOCALES;
	if (!env || !env.trim()) return SUPPORTED_LOCALES_FALLBACK;
	return env
		.split(",")
		.map((l) => l.trim())
		.filter(Boolean);
}

export function isLocaleSupported(locale) {
	if (!locale || typeof locale !== "string") return false;
	return getSupportedLocales().includes(locale.trim());
}
