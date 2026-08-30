import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../hooks/use-auth";

export default function SignInScreen() {
	const router = useRouter();
	const { signIn, isLoading } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	async function handleSignIn() {
		if (!email || !password) {
			Alert.alert("Error", "Please enter email and password");
			return;
		}

		try {
			await signIn(email, password);
			router.replace("/(app)");
		} catch (error) {
			Alert.alert("Sign In Failed", error.message || "Invalid credentials");
		}
	}

	return (
		<View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
			<Text style={{ fontSize: 28, fontWeight: "bold", marginBottom: 32, textAlign: "center" }}>
				Welcome Back
			</Text>

			<TextInput
				placeholder="Email"
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
				autoComplete="email"
				style={{
					borderWidth: 1,
					borderColor: "#ccc",
					borderRadius: 8,
					padding: 12,
					marginBottom: 12,
					fontSize: 16,
				}}
			/>

			<TextInput
				placeholder="Password"
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				autoComplete="password"
				style={{
					borderWidth: 1,
					borderColor: "#ccc",
					borderRadius: 8,
					padding: 12,
					marginBottom: 20,
					fontSize: 16,
				}}
			/>

			<Pressable
				onPress={handleSignIn}
				disabled={isLoading}
				style={{
					backgroundColor: "#000",
					padding: 14,
					borderRadius: 8,
					alignItems: "center",
					opacity: isLoading ? 0.6 : 1,
				}}
			>
				<Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
					{isLoading ? "Signing in..." : "Sign In"}
				</Text>
			</Pressable>

			<Pressable onPress={() => router.push("/(auth)/sign-up")} style={{ marginTop: 16, alignItems: "center" }}>
				<Text style={{ color: "#666" }}>
					Don't have an account? <Text style={{ fontWeight: "600" }}>Sign Up</Text>
				</Text>
			</Pressable>
		</View>
	);
}
