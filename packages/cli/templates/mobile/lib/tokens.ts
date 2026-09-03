import { useTheme } from "../components/ThemeProvider";

export interface ThemeTokens {
	isDark: boolean;
	bg: string;
	text: string;
	muted: string;
	card: string;
	border: string;
	inputBg: string;
	primary: string;
	primaryText: string;
	danger: string;
}

export function useThemeTokens(): ThemeTokens {
	const theme = useTheme();
	const isDark = theme === "dark";
	return {
		isDark,
		bg: isDark ? "#000" : "#fff",
		text: isDark ? "#fff" : "#000",
		muted: isDark ? "#888" : "#666",
		card: isDark ? "#1c1c1e" : "#f2f2f7",
		border: isDark ? "#38383a" : "#e5e5ea",
		inputBg: isDark ? "#2c2c2e" : "#fff",
		primary: isDark ? "#fff" : "#000",
		primaryText: isDark ? "#000" : "#fff",
		danger: "#ff3b30",
	};
}
