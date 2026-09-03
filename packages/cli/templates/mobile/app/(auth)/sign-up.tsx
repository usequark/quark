import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useThemeTokens } from "../../lib/tokens";
import { createStyles } from "../../lib/styles";

export default function SignUpScreen() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const t = useThemeTokens();
	const s = createStyles(t);

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
			style={{ ...s.screen, justifyContent: "center", padding: 20 }}
			accessibilityLabel="Create account screen"
		>
			<Text
				style={{
					fontSize: 28,
					fontWeight: "bold",
					marginBottom: 32,
					textAlign: "center",
					color: t.text,
				}}
				accessibilityRole="header"
			>
				Create Account
			</Text>

			<TextInput
				placeholder="Name"
				placeholderTextColor={t.muted}
				value={name}
				onChangeText={setName}
				autoComplete="name"
				style={{
					...s.input,
					marginBottom: 12,
				}}
				accessibilityLabel="Full name"
				accessibilityHint="Enter your full name"
			/>

			<TextInput
				placeholder="Email"
				placeholderTextColor={t.muted}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
				autoComplete="email"
				style={{
					...s.input,
					marginBottom: 12,
				}}
				accessibilityLabel="Email address"
				accessibilityHint="Enter your email address"
			/>

			<TextInput
				placeholder="Password"
				placeholderTextColor={t.muted}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				autoComplete="password-new"
				style={{
					...s.input,
					marginBottom: 20,
				}}
				accessibilityLabel="Password"
				accessibilityHint="Choose a password for your account"
			/>

			<Pressable
				onPress={handleSignUp}
				disabled={loading}
				style={{
					...s.primaryButton,
					opacity: loading ? 0.6 : 1,
				}}
				accessibilityLabel="Create account"
				accessibilityRole="button"
				accessibilityState={{ disabled: loading }}
			>
				<Text style={s.primaryButtonText}>
					{loading ? "Creating account..." : "Sign Up"}
				</Text>
			</Pressable>

			<Pressable
				onPress={() => router.back()}
				style={s.linkButton}
				accessibilityLabel="Go to sign in screen"
				accessibilityRole="button"
				accessibilityHint="Opens the sign in screen"
			>
				<Text style={s.linkButtonText}>
					Already have an account?{" "}
					<Text style={s.linkText}>Sign In</Text>
				</Text>
			</Pressable>
		</View>
	);
}
