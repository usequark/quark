import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "../../hooks/use-auth";
import { useThemeTokens } from "../../lib/tokens";
import { createStyles } from "../../lib/styles";

export default function SettingsScreen() {
	const router = useRouter();
	const { signOut } = useAuth();
	const t = useThemeTokens();
	const s = createStyles(t);

	async function handleSignOut() {
		await signOut();
		router.replace("/(auth)/sign-in");
	}

	return (
		<View style={{ ...s.screen, padding: 20 }} accessibilityLabel="Settings screen">
			<Text style={s.header} accessibilityRole="header">
				Settings
			</Text>

			<View style={s.card} accessibilityLabel="App info section">
				<Text style={s.label}>App</Text>
				<Text style={s.value}>Quark Mobile</Text>
				<Text style={{ fontSize: 14, color: t.muted, marginTop: 4 }}>
					Version 0.1.0
				</Text>
			</View>

			<Pressable
				onPress={handleSignOut}
				style={{
					backgroundColor: t.danger,
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
