import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../components/ThemeProvider";
import { useAuth } from "../../hooks/use-auth";

export default function SettingsScreen() {
	const router = useRouter();
	const { signOut } = useAuth();
	const theme = useTheme();

	const isDark = theme === "dark";
	const bgColor = isDark ? "#000" : "#fff";
	const textColor = isDark ? "#fff" : "#000";
	const mutedColor = isDark ? "#888" : "#666";
	const cardBg = isDark ? "#1c1c1e" : "#f2f2f7";
	const borderColor = isDark ? "#38383a" : "#e5e5ea";

	async function handleSignOut() {
		await signOut();
		router.replace("/(auth)/sign-in");
	}

	return (
		<View
			style={{ flex: 1, backgroundColor: bgColor, padding: 20 }}
			accessibilityLabel="Settings screen"
		>
			<Text
				style={{
					fontSize: 28,
					fontWeight: "bold",
					color: textColor,
					marginBottom: 24,
				}}
				accessibilityRole="header"
			>
				Settings
			</Text>

			<View
				style={{
					backgroundColor: cardBg,
					borderRadius: 12,
					padding: 16,
					marginBottom: 16,
					borderWidth: 1,
					borderColor,
				}}
				accessibilityLabel="App info section"
			>
				<Text style={{ fontSize: 14, color: mutedColor, marginBottom: 4 }}>
					App
				</Text>
				<Text style={{ fontSize: 16, color: textColor }}>Quark Mobile</Text>
				<Text style={{ fontSize: 14, color: mutedColor, marginTop: 4 }}>
					Version 0.1.0
				</Text>
			</View>

			<Pressable
				onPress={handleSignOut}
				style={{
					backgroundColor: "#ff3b30",
					paddingHorizontal: 24,
					paddingVertical: 14,
					borderRadius: 8,
					alignItems: "center",
				}}
				accessibilityLabel="Sign out of your account"
				accessibilityRole="button"
				accessibilityHint="Signs you out and returns to the sign in screen"
			>
				<Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
					Sign Out
				</Text>
			</Pressable>
		</View>
	);
}
