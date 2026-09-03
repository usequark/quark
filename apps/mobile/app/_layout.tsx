import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../components/ThemeProvider";
import { useAuthInit } from "../hooks/use-auth";

export default function RootLayout() {
	useAuthInit();

	return (
		<SafeAreaProvider>
			<ThemeProvider>
				<StatusBar style="auto" />
				<Slot />
			</ThemeProvider>
		</SafeAreaProvider>
	);
}
