import "./globals.css";
import { ThemeProvider } from "@usequark/quark-ui";
import {
	THEME_ATTR,
	THEME_STORAGE_KEY,
} from "@usequark/quark-ui/theme-constants";
import { buildUmamiBeforeSendScript } from "../lib/analytics/umami-before-send.js";
import { getUmamiConfig } from "../lib/analytics/umami-config.js";
import { getSiteMetadata } from "../lib/seo/site-metadata.js";
import UmamiReplayRecorder from "./_components/UmamiReplayRecorder.js";
import UmamiWebVitals from "./_components/UmamiWebVitals.js";
export function generateMetadata() {
	return getSiteMetadata();
}

/* Blocking script that sets data-theme before first paint (FOUC prevention). */
const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||t==="light"){document.documentElement.setAttribute("${THEME_ATTR}",t)}else if(matchMedia("(prefers-color-scheme:dark)").matches){document.documentElement.setAttribute("${THEME_ATTR}","dark")}}catch(e){}})()`;

// Inline Umami before-send handler that drops events from admin pages (/admin/*)
// and any staff user (identified by the umami_user_role cookie set by the admin layout).
const umamiBeforeSendScript = buildUmamiBeforeSendScript();

export default function RootLayout({ children }) {
	const umamiConfig = getUmamiConfig();

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static constant, not user input */}
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static inline before-send handler */}
				<script dangerouslySetInnerHTML={{ __html: umamiBeforeSendScript }} />
				{umamiConfig.enabled ? (
					<>
						<link
							crossOrigin="anonymous"
							href={umamiConfig.origin}
							rel="preconnect"
						/>
						<link href={umamiConfig.dnsPrefetchHref} rel="dns-prefetch" />
						<script
							defer
							data-performance="true"
							data-website-id={umamiConfig.websiteId}
							src={umamiConfig.scriptUrl}
							data-before-send="__umamiBeforeSend"
						/>
					</>
				) : null}
			</head>
			<body>
				{/* ThemeProvider renders no markup. It publishes theme state to
				    React consumers (useTheme/ThemeToggle) and syncs data-theme
				    after hydration via useLayoutEffect, which is why it must
				    coexist with the blocking script above rather than replace it. */}
				<ThemeProvider>{children}</ThemeProvider>
				{umamiConfig.enabled ? <UmamiWebVitals /> : null}
				{umamiConfig.replayEnabled ? <UmamiReplayRecorder /> : null}
			</body>
		</html>
	);
}
