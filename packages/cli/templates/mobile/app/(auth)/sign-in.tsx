import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../hooks/use-auth";
import { useThemeTokens } from "../../lib/tokens";
import { createStyles } from "../../lib/styles";

export default function SignInScreen() {
	const router = useRouter();
	const { signIn, isLoading } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const t = useThemeTokens();
	const s = createStyles(t);

	async function handleSignIn() {
		if (!email || !password) {
			Alert.alert("Error", "Please enter email and password");
			return;
		}

		try {
			await signIn(email, password);
			router.replace("/(app)");
		} catch (error: unknown) {
			Alert.alert(
				"Sign In Failed",
				error instanceof Error ? error.message : "Invalid credentials",
			);
		}
	}

	return (
		<View
			style={{ ...s.screen, justifyContent: "center", padding: 20 }}
			accessibilityLabel="Sign in screen"
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
				Welcome Back
			</Text>

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
				accessibilityHint="Enter your email address to sign in"
			/>

			<TextInput
				placeholder="Password"
				placeholderTextColor={t.muted}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				autoComplete="password"
				style={{
					...s.input,
					marginBottom: 20,
				}}
				accessibilityLabel="Password"
				accessibilityHint="Enter your password to sign in"
			/>

			<Pressable
				onPress={handleSignIn}
				disabled={isLoading}
				style={{
					...s.primaryButton,
					opacity: isLoading ? 0.6 : 1,
				}}
				accessibilityLabel="Sign in"
				accessibilityRole="button"
				accessibilityState={{ disabled: isLoading }}
			>
				<Text style={s.primaryButtonText}>
					{isLoading ? "Signing in..." : "Sign In"}
				</Text>
			</Pressable>

			<Pressable
				onPress={() => router.push("/(auth)/sign-up")}
				style={s.linkButton}
				accessibilityLabel="Go to sign up screen"
				accessibilityRole="button"
				accessibilityHint="Opens the account creation screen"
			>
				<Text style={s.linkButtonText}>
					Don't have an account?{" "}
					<Text style={s.linkText}>Sign Up</Text>
				</Text>
			</Pressable>
		</View>
	);
}
