import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeTokens } from "../../lib/theme-tokens";
import { useAuth } from "../../hooks/use-auth";

export default function SignInScreen() {
	const router = useRouter();
	const { signIn, isLoading } = useAuth();
	const {
		bgColor,
		textColor,
		mutedColor,
		cardBg,
		borderColor,
		inputBg,
		isDark,
	} = useThemeTokens();
	const insets = useSafeAreaInsets();
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
		} catch (error: unknown) {
			Alert.alert(
				"Sign In Failed",
				error instanceof Error ? error.message : "Invalid credentials",
			);
		}
	}

	return (
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				padding: 20,
				paddingTop: insets.top + 20,
				backgroundColor: bgColor,
			}}
			accessibilityLabel="Sign in screen"
		>
			<Text
				style={{
					fontSize: 28,
					fontWeight: "bold",
					color: textColor,
					marginBottom: 32,
					textAlign: "center",
				}}
				accessibilityRole="header"
			>
				Welcome Back
			</Text>

			<TextInput
				placeholder="Email"
				placeholderTextColor={mutedColor}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
				autoComplete="email"
				style={{
					backgroundColor: inputBg,
					borderWidth: 1,
					borderColor,
					borderRadius: 8,
					padding: 12,
					marginBottom: 12,
					fontSize: 16,
					color: textColor,
				}}
				accessibilityLabel="Email address"
				accessibilityHint="Enter your email address to sign in"
			/>

			<TextInput
				placeholder="Password"
				placeholderTextColor={mutedColor}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				autoComplete="password"
				style={{
					backgroundColor: inputBg,
					borderWidth: 1,
					borderColor,
					borderRadius: 8,
					padding: 12,
					marginBottom: 20,
					fontSize: 16,
					color: textColor,
				}}
				accessibilityLabel="Password"
				accessibilityHint="Enter your password to sign in"
			/>

			<Pressable
				onPress={handleSignIn}
				disabled={isLoading}
				style={{
					backgroundColor: isDark ? "#fff" : "#000",
					padding: 14,
					borderRadius: 8,
					alignItems: "center",
					opacity: isLoading ? 0.6 : 1,
				}}
				accessibilityLabel="Sign in"
				accessibilityRole="button"
				accessibilityState={{ disabled: isLoading }}
			>
				<Text
					style={{
						color: isDark ? "#000" : "#fff",
						fontSize: 16,
						fontWeight: "600",
					}}
				>
					{isLoading ? "Signing in..." : "Sign In"}
				</Text>
			</Pressable>

			<Pressable
				onPress={() => router.push("/(auth)/sign-up")}
				style={{ marginTop: 16, alignItems: "center" }}
				accessibilityLabel="Go to sign up screen"
				accessibilityRole="button"
				accessibilityHint="Opens the account creation screen"
			>
				<Text style={{ color: mutedColor }}>
					Don't have an account?{" "}
					<Text style={{ fontWeight: "600", color: textColor }}>Sign Up</Text>
				</Text>
			</Pressable>
		</View>
	);
}
