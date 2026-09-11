import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthGate } from "../../components/AuthGate";
import { useTheme } from "../../components/ThemeProvider";
import { useAuth } from "../../hooks/use-auth";

export default function AppLayout() {
	const { isAuthenticated, isLoading } = useAuth();
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const isDark = theme === "dark";

	if (isLoading) {
		return null;
	}

	if (!isAuthenticated) {
		return <Redirect href="/(auth)/sign-in" />;
	}

	return (
		<AuthGate>
			<Tabs
				screenOptions={{
					headerShown: false,
					tabBarStyle: {
						backgroundColor: isDark ? "#1c1c1e" : "#ffffff",
						borderTopColor: isDark ? "#38383a" : "#e5e5ea",
						paddingBottom: Platform.OS === "ios" ? insets.bottom : 8,
						height: Platform.OS === "ios" ? 88 : 64,
					},
					tabBarActiveTintColor: isDark ? "#fff" : "#000",
					tabBarInactiveTintColor: isDark ? "#888" : "#666",
				}}
			>
				<Tabs.Screen
					name="index"
					options={{
						title: "Home",
						tabBarLabel: "Home",
						tabBarIcon: ({ color, size }) => (
							<Ionicons
								name="home-outline"
								size={size}
								color={color as string}
							/>
						),
					}}
				/>
				<Tabs.Screen
					name="profile"
					options={{
						title: "Profile",
						tabBarLabel: "Profile",
						tabBarIcon: ({ color, size }) => (
							<Ionicons
								name="person-outline"
								size={size}
								color={color as string}
							/>
						),
					}}
				/>
				<Tabs.Screen
					name="settings"
					options={{
						title: "Settings",
						tabBarLabel: "Settings",
						tabBarIcon: ({ color, size }) => (
							<Ionicons
								name="settings-outline"
								size={size}
								color={color as string}
							/>
						),
					}}
				/>
			</Tabs>
		</AuthGate>
	);
}
