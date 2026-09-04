import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeTokens } from "../../lib/theme-tokens";
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
	const { bgColor, textColor, mutedColor, cardBg, borderColor, isDark } =
		useThemeTokens();
	const insets = useSafeAreaInsets();
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
			contentContainerStyle={{
				padding: 20,
				paddingTop: insets.top + 20,
			}}
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
