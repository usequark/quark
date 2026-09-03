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
import { useAuth } from "../../hooks/use-auth";
import { getProfile, updateProfile } from "../../lib/auth";
import { useThemeTokens } from "../../lib/tokens";
import { createStyles } from "../../lib/styles";

interface UserProfile {
	id: string;
	email: string;
	name: string | null;
	role: string;
}

export default function ProfileScreen() {
	const { isAuthenticated } = useAuth();
	const t = useThemeTokens();
	const s = createStyles(t);
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
				style={{ ...s.screen, justifyContent: "center", alignItems: "center" }}
				accessibilityLabel="Loading profile"
				accessibilityRole="progressbar"
			>
				<ActivityIndicator size="large" color={t.primary} />
			</View>
		);
	}

	return (
		<ScrollView
			style={s.screen}
			contentContainerStyle={s.scrollContent}
			accessibilityLabel="Profile screen"
		>
			<Text style={s.header} accessibilityRole="header">
				Profile
			</Text>

			<Text style={{ fontSize: 14, color: t.muted, marginBottom: 8 }}>
				Name
			</Text>
			<TextInput
				value={name}
				onChangeText={setName}
				placeholder="Your name"
				placeholderTextColor={t.muted}
				autoComplete="name"
				style={s.input}
				accessibilityLabel="Name input"
				accessibilityHint="Enter your display name"
			/>

			<Text style={{ fontSize: 14, color: t.muted, marginBottom: 8 }}>
				Email
			</Text>
			<View
				style={{
					...s.card,
					marginBottom: 16,
				}}
				accessibilityLabel="Email display"
			>
				<Text style={{ fontSize: 16, color: t.muted }}>
					{profile?.email}
				</Text>
			</View>

			<Text style={{ fontSize: 14, color: t.muted, marginBottom: 8 }}>
				Role
			</Text>
			<View
				style={{
					...s.card,
					marginBottom: 24,
				}}
				accessibilityLabel="Role display"
			>
				<Text style={{ ...s.value, textTransform: "capitalize" }}>
					{profile?.role || "viewer"}
				</Text>
			</View>

			<Pressable
				onPress={handleSave}
				disabled={saving}
				style={{
					...s.primaryButton,
					opacity: saving ? 0.6 : 1,
				}}
				accessibilityLabel="Save profile changes"
				accessibilityRole="button"
				accessibilityState={{ disabled: saving }}
			>
				<Text style={s.primaryButtonText}>
					{saving ? "Saving..." : "Save Changes"}
				</Text>
			</Pressable>
		</ScrollView>
	);
}
