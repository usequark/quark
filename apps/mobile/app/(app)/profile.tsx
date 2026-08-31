import { Text, View } from "react-native";

export default function ProfileScreen() {
	return (
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				alignItems: "center",
				padding: 20,
			}}
		>
			<Text style={{ fontSize: 24, fontWeight: "bold" }}>Profile</Text>
			<Text style={{ marginTop: 8, color: "#666" }}>Your profile details</Text>
		</View>
	);
}
