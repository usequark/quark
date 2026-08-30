import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/use-auth";

export default function SettingsScreen() {
	const router = useRouter();
	const { signOut } = useAuth();

	async function handleSignOut() {
		await signOut();
		router.replace("/(auth)/sign-in");
	}

	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
			<Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 24 }}>Settings</Text>

			<Pressable
				onPress={handleSignOut}
				style={{
					backgroundColor: "#ff3b30",
					paddingHorizontal: 24,
					paddingVertical: 12,
					borderRadius: 8,
				}}
			>
				<Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Sign Out</Text>
			</Pressable>
		</View>
	);
}
