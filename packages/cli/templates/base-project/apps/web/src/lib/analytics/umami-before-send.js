/**
 * Pure decision helper for the Umami data-before-send hook.
 * Returns true when the payload should be dropped.
 *
 * @param {{ url?: string, roleCookie?: string | null }} input
 * @returns {boolean}
 */
export function shouldBlockUmamiPayload({ url, roleCookie } = {}) {
	if (roleCookie) return true;
	if (!url) return false;
	try {
		const pathname = new URL(url, "http://localhost").pathname;
		return pathname.startsWith("/admin");
	} catch {
		return false;
	}
}

/**
 * Build a self-contained inline script that defines window.__umamiBeforeSend.
 * Embeds shouldBlockUmamiPayload via .toString() so the inline handler and
 * unit-tested pure function cannot drift.
 *
 * @returns {string}
 */
export function buildUmamiBeforeSendScript() {
	// shouldBlockUmamiPayload.toString() already includes the "function name(){...}" form.
	return `window.__umamiBeforeSend=function(t,p){var r=(document.cookie.match(/umami_user_role=([^;]+)/)||[])[1];if(shouldBlockUmamiPayload({url:p.url,roleCookie:r}))return false;return p};${shouldBlockUmamiPayload.toString()}`;
}
