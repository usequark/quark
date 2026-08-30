import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
	return (
		<>
			<Stack.Screen options={{ title: "Oops!" }} />
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
				<Text style={{ fontSize: 20, fontWeight: "bold" }}>Page not found</Text>
				<Text style={{ marginTop: 8, color: "#666" }}>This screen doesn't exist.</Text>
				<Link href="/" style={{ marginTop: 16 }}>
					<Text style={{ color: "#007AFF" }}>Go to home screen</Text>
				</Link>
			</View>
		</>
	);
}
