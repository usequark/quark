"use client";

import { ThemeProvider, ThemeToggle } from "@techstream/quark-ui";

export default function AdminThemeToggle() {
	return (
		<ThemeProvider>
			<ThemeToggle />
		</ThemeProvider>
	);
}
