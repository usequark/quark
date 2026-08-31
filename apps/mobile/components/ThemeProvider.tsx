import { createContext, type ReactNode, useContext } from "react";
import { useColorScheme } from "react-native";

type Theme = "light" | "dark";

const ThemeContext = createContext<Theme>("light");

export function useTheme(): Theme {
	return useContext(ThemeContext);
}

interface ThemeProviderProps {
	children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
	const colorScheme = useColorScheme();
	const theme: Theme = colorScheme === "dark" ? "dark" : "light";

	return (
		<ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
	);
}
