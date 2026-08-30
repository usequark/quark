import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider } from "../components/ThemeProvider";
import { useAuthInit } from "../hooks/use-auth";

export default function RootLayout() {
	useAuthInit();

	return (
		<ThemeProvider>
			<StatusBar style="auto" />
			<Slot />
		</ThemeProvider>
	);
}
