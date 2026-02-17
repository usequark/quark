import { getSiteMetadata } from "../lib/seo/site-metadata.js";

export const metadata = getSiteMetadata();

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
