import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";
import { useAuth } from "../../hooks/use-auth";
import { getProfile } from "../../lib/auth";
import { useThemeTokens } from "../../lib/tokens";
import { createStyles } from "../../lib/styles";

interface UserProfile {
	id: string;
	email: string;
	name: string | null;
	role: string;
}

export default function HomeScreen() {
	const { isAuthenticated } = useAuth();
	const t = useThemeTokens();
	const s = createStyles(t);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const fetchProfile = useCallback(async () => {
		try {
			const data = await getProfile();
			setProfile(data);
		} catch {
			// Profile fetch failed - non-critical
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		if (isAuthenticated) {
			fetchProfile();
		}
	}, [isAuthenticated, fetchProfile]);

	async function onRefresh() {
		setRefreshing(true);
		await fetchProfile();
	}

	if (loading) {
		return (
			<View
				style={{ ...s.screen, justifyContent: "center", alignItems: "center" }}
				accessibilityLabel="Loading home screen"
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
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}
			accessibilityLabel="Home screen content"
		>
			<Text style={s.header} accessibilityRole="header">
				Welcome{profile?.name ? `, ${profile.name}` : ""}
			</Text>
			<Text style={{ fontSize: 16, color: t.muted, marginBottom: 24 }}>
				{profile?.email || "Signed in to your account"}
			</Text>

			<View style={s.card} accessibilityLabel="Account info card" accessibilityRole="summary">
				<Text style={s.label}>Account</Text>
				<Text style={s.value}>{profile?.name || "No name set"}</Text>
				<Text style={{ fontSize: 14, color: t.muted, marginTop: 4 }}>
					{profile?.email}
				</Text>
			</View>

			<View style={s.cardLast} accessibilityLabel="Quick actions card" accessibilityRole="summary">
				<Text style={s.label}>Role</Text>
				<Text style={{ ...s.value, textTransform: "capitalize" }}>
					{profile?.role || "viewer"}
				</Text>
			</View>
		</ScrollView>
	);
}
