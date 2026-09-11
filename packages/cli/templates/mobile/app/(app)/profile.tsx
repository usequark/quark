import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/use-auth";
import { getProfile, updateProfile } from "../../lib/auth";
import { useThemeTokens } from "../../lib/theme-tokens";

interface UserProfile {
	id: string;
	email: string;
	name: string | null;
	role: string;
}

export default function ProfileScreen() {
	const { isAuthenticated } = useAuth();
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
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [name, setName] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (isAuthenticated) {
			(async () => {
				try {
					const data = await getProfile();
					setProfile(data);
					setName(data.name || "");
				} catch {
					// Non-critical
				} finally {
					setLoading(false);
				}
			})();
		}
	}, [isAuthenticated]);

	async function handleSave() {
		if (!name.trim()) {
			Alert.alert("Error", "Name cannot be empty");
			return;
		}
		setSaving(true);
		try {
			const updated = await updateProfile({ name: name.trim() });
			setProfile(updated);
			Alert.alert("Saved", "Profile updated successfully");
		} catch {
			Alert.alert("Error", "Failed to update profile. Please try again.");
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return (
			<View
				style={{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					backgroundColor: bgColor,
				}}
				accessibilityLabel="Loading profile"
				accessibilityRole="progressbar"
			>
				<ActivityIndicator size="large" color={isDark ? "#fff" : "#000"} />
			</View>
		);
	}

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: bgColor }}
			contentContainerStyle={{
				padding: 20,
				paddingTop: insets.top + 20,
			}}
			accessibilityLabel="Profile screen"
		>
			<Text
				style={{
					fontSize: 28,
					fontWeight: "bold",
					color: textColor,
					marginBottom: 24,
				}}
				accessibilityRole="header"
			>
				Profile
			</Text>

			<Text style={{ fontSize: 14, color: mutedColor, marginBottom: 8 }}>
				Name
			</Text>
			<TextInput
				value={name}
				onChangeText={setName}
				placeholder="Your name"
				placeholderTextColor={mutedColor}
				autoComplete="name"
				style={{
					backgroundColor: inputBg,
					borderWidth: 1,
					borderColor,
					borderRadius: 8,
					padding: 12,
					marginBottom: 16,
					fontSize: 16,
					color: textColor,
				}}
				accessibilityLabel="Name input"
				accessibilityHint="Enter your display name"
			/>

			<Text style={{ fontSize: 14, color: mutedColor, marginBottom: 8 }}>
				Email
			</Text>
			<View
				style={{
					backgroundColor: cardBg,
					borderWidth: 1,
					borderColor,
					borderRadius: 8,
					padding: 12,
					marginBottom: 16,
				}}
				accessibilityLabel="Email display"
			>
				<Text style={{ fontSize: 16, color: mutedColor }}>
					{profile?.email}
				</Text>
			</View>

			<Text style={{ fontSize: 14, color: mutedColor, marginBottom: 8 }}>
				Role
			</Text>
			<View
				style={{
					backgroundColor: cardBg,
					borderWidth: 1,
					borderColor,
					borderRadius: 8,
					padding: 12,
					marginBottom: 24,
				}}
				accessibilityLabel="Role display"
			>
				<Text
					style={{
						fontSize: 16,
						color: textColor,
						textTransform: "capitalize",
					}}
				>
					{profile?.role || "viewer"}
				</Text>
			</View>

			<Pressable
				onPress={handleSave}
				disabled={saving}
				style={{
					backgroundColor: isDark ? "#fff" : "#000",
					padding: 14,
					borderRadius: 8,
					alignItems: "center",
					opacity: saving ? 0.6 : 1,
				}}
				accessibilityLabel="Save profile changes"
				accessibilityRole="button"
				accessibilityState={{ disabled: saving }}
			>
				<Text
					style={{
						color: isDark ? "#000" : "#fff",
						fontSize: 16,
						fontWeight: "600",
					}}
				>
					{saving ? "Saving..." : "Save Changes"}
				</Text>
			</Pressable>
		</ScrollView>
	);
}
