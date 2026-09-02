import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

export default function SignUpScreen() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSignUp() {
		if (!name || !email || !password) {
			Alert.alert("Error", "Please fill in all fields");
			return;
		}

		setLoading(true);
		try {
			const { getConfig } = await import("../../lib/config");
			const config = getConfig();

			const response = await fetch(`${config.apiUrl}/api/auth/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, email, password }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Registration failed");
			}

			Alert.alert("Success", "Account created! Please sign in.", [
				{ text: "OK", onPress: () => router.replace("/(auth)/sign-in") },
			]);
		} catch (error: unknown) {
			Alert.alert(
				"Sign Up Failed",
				error instanceof Error ? error.message : "Registration failed",
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<View
			style={{ flex: 1, justifyContent: "center", padding: 20 }}
			accessibilityLabel="Create account screen"
		>
			<Text
				style={{
					fontSize: 28,
					fontWeight: "bold",
					marginBottom: 32,
					textAlign: "center",
				}}
				accessibilityRole="header"
			>
				Create Account
			</Text>

			<TextInput
				placeholder="Name"
				value={name}
				onChangeText={setName}
				autoComplete="name"
				style={{
					borderWidth: 1,
					borderColor: "#ccc",
					borderRadius: 8,
					padding: 12,
					marginBottom: 12,
					fontSize: 16,
				}}
				accessibilityLabel="Full name"
				accessibilityHint="Enter your full name"
			/>

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
				accessibilityLabel="Email address"
				accessibilityHint="Enter your email address"
			/>

			<TextInput
				placeholder="Password"
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				autoComplete="password-new"
				style={{
					borderWidth: 1,
					borderColor: "#ccc",
					borderRadius: 8,
					padding: 12,
					marginBottom: 20,
					fontSize: 16,
				}}
				accessibilityLabel="Password"
				accessibilityHint="Choose a password for your account"
			/>

			<Pressable
				onPress={handleSignUp}
				disabled={loading}
				style={{
					backgroundColor: "#000",
					padding: 14,
					borderRadius: 8,
					alignItems: "center",
					opacity: loading ? 0.6 : 1,
				}}
				accessibilityLabel="Create account"
				accessibilityRole="button"
				accessibilityState={{ disabled: loading }}
			>
				<Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
					{loading ? "Creating account..." : "Sign Up"}
				</Text>
			</Pressable>

			<Pressable
				onPress={() => router.back()}
				style={{ marginTop: 16, alignItems: "center" }}
				accessibilityLabel="Go to sign in screen"
				accessibilityRole="button"
				accessibilityHint="Opens the sign in screen"
			>
				<Text style={{ color: "#666" }}>
					Already have an account?{" "}
					<Text style={{ fontWeight: "600" }}>Sign In</Text>
				</Text>
			</Pressable>
		</View>
	);
}
