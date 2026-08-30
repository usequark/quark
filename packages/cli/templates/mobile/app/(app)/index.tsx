import { Text, View } from "react-native";

export default function HomeScreen() {
	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
			<Text style={{ fontSize: 24, fontWeight: "bold" }}>Home</Text>
			<Text style={{ marginTop: 8, color: "#666" }}>Welcome to your Quark app</Text>
		</View>
	);
}
