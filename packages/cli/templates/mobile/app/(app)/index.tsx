import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";
import { useTheme } from "../../components/ThemeProvider";
import { useAuth } from "../../hooks/use-auth";
import { getProfile } from "../../lib/auth";

interface UserProfile {
	id: string;
	email: string;
	name: string | null;
	role: string;
}

export default function HomeScreen() {
	const { isAuthenticated } = useAuth();
	const theme = useTheme();
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const isDark = theme === "dark";
	const bgColor = isDark ? "#000" : "#fff";
	const textColor = isDark ? "#fff" : "#000";
	const mutedColor = isDark ? "#888" : "#666";
	const cardBg = isDark ? "#1c1c1e" : "#f2f2f7";
	const borderColor = isDark ? "#38383a" : "#e5e5ea";

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
				style={{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					backgroundColor: bgColor,
				}}
				accessibilityLabel="Loading home screen"
				accessibilityRole="progressbar"
			>
				<ActivityIndicator size="large" color={isDark ? "#fff" : "#000"} />
			</View>
		);
	}

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: bgColor }}
			contentContainerStyle={{ padding: 20 }}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}
			accessibilityLabel="Home screen content"
		>
			<Text
				style={{
					fontSize: 28,
					fontWeight: "bold",
					color: textColor,
					marginBottom: 8,
				}}
				accessibilityRole="header"
			>
				Welcome{profile?.name ? `, ${profile.name}` : ""}
			</Text>
			<Text style={{ fontSize: 16, color: mutedColor, marginBottom: 24 }}>
				{profile?.email || "Signed in to your account"}
			</Text>

			<View
				style={{
					backgroundColor: cardBg,
					borderRadius: 12,
					padding: 16,
					marginBottom: 16,
					borderWidth: 1,
					borderColor,
				}}
				accessibilityLabel="Account info card"
				accessibilityRole="summary"
			>
				<Text style={{ fontSize: 14, color: mutedColor, marginBottom: 4 }}>
					Account
				</Text>
				<Text style={{ fontSize: 16, color: textColor, fontWeight: "500" }}>
					{profile?.name || "No name set"}
				</Text>
				<Text style={{ fontSize: 14, color: mutedColor, marginTop: 4 }}>
					{profile?.email}
				</Text>
			</View>

			<View
				style={{
					backgroundColor: cardBg,
					borderRadius: 12,
					padding: 16,
					borderWidth: 1,
					borderColor,
				}}
				accessibilityLabel="Quick actions card"
				accessibilityRole="summary"
			>
				<Text style={{ fontSize: 14, color: mutedColor, marginBottom: 4 }}>
					Role
				</Text>
				<Text
					style={{
						fontSize: 16,
						color: textColor,
						fontWeight: "500",
						textTransform: "capitalize",
					}}
				>
					{profile?.role || "viewer"}
				</Text>
			</View>
		</ScrollView>
	);
}
