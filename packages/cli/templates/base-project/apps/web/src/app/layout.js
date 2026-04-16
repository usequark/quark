import "./globals.css";
import {
	THEME_ATTR,
	THEME_STORAGE_KEY,
} from "@techstream/quark-ui/theme-constants";
import { headers } from "next/headers";
import { getSiteMetadata } from "../lib/seo/site-metadata.js";
import FloatingThemeToggle from "./layout/_components/FloatingThemeToggle.js";

export async function generateMetadata() {
	await headers();
	return getSiteMetadata();
}

/* Blocking script that sets data-theme before first paint (FOUC prevention). */
const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||t==="light"){document.documentElement.setAttribute("${THEME_ATTR}",t)}else if(matchMedia("(prefers-color-scheme:dark)").matches){document.documentElement.setAttribute("${THEME_ATTR}","dark")}}catch(e){}})()`;

export default function RootLayout({ children }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static constant, not user input */}
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
			</head>
			<body>
				<FloatingThemeToggle />
				{children}
			</body>
		</html>
	);
}
