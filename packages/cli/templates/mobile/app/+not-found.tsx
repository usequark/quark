import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";
import { useThemeTokens } from "../lib/tokens";

export default function NotFoundScreen() {
	const t = useThemeTokens();

	return (
		<>
			<Stack.Screen options={{ title: "Oops!" }} />
			<View
				style={{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					padding: 20,
					backgroundColor: t.bg,
				}}
			>
				<Text style={{ fontSize: 20, fontWeight: "bold", color: t.text }}>
					Page not found
				</Text>
				<Text style={{ marginTop: 8, color: t.muted }}>
					This screen doesn't exist.
				</Text>
				<Link href="/" style={{ marginTop: 16 }}>
					<Text style={{ color: "#007AFF" }}>Go to home screen</Text>
				</Link>
			</View>
		</>
	);
}
