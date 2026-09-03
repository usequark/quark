import { useTheme } from "./ThemeProvider";

export function useThemeTokens() {
	const theme = useTheme();
	const isDark = theme === "dark";

	return {
		isDark,
		bgColor: isDark ? "#000" : "#fff",
		textColor: isDark ? "#fff" : "#000",
		mutedColor: isDark ? "#888" : "#666",
		cardBg: isDark ? "#1c1c1e" : "#f2f2f7",
		borderColor: isDark ? "#38383a" : "#e5e5ea",
		inputBg: isDark ? "#2c2c2e" : "#fff",
	};
}
