import "./globals.css";
import {
	THEME_ATTR,
	THEME_STORAGE_KEY,
} from "@techstream/quark-ui/theme-constants";
import { headers } from "next/headers";
import Script from "next/script";
import { getUmamiConfig } from "../lib/analytics/umami-config.js";
import { getSiteMetadata } from "../lib/seo/site-metadata.js";
import UmamiReplayRecorder from "./_components/UmamiReplayRecorder.js";
export async function generateMetadata() {
	await headers();
	return getSiteMetadata();
}

/* Blocking script that sets data-theme before first paint (FOUC prevention). */
const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||t==="light"){document.documentElement.setAttribute("${THEME_ATTR}",t)}else if(matchMedia("(prefers-color-scheme:dark)").matches){document.documentElement.setAttribute("${THEME_ATTR}","dark")}}catch(e){}})()`;

export default function RootLayout({ children }) {
	const umamiConfig = getUmamiConfig();

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static constant, not user input */}
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
				{umamiConfig.enabled ? (
					<>
						<link
							crossOrigin="anonymous"
							href={umamiConfig.origin}
							rel="preconnect"
						/>
						<link href={umamiConfig.dnsPrefetchHref} rel="dns-prefetch" />
						<Script
							data-website-id={umamiConfig.websiteId}
							src={umamiConfig.scriptUrl}
							strategy="afterInteractive"
						/>
					</>
				) : null}
			</head>
			<body>
				{children}
				{umamiConfig.replayEnabled ? <UmamiReplayRecorder /> : null}
			</body>
		</html>
	);
}
