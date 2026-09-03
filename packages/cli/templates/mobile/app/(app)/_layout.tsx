import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthGate } from "../../components/AuthGate";
import { useAuth } from "../../hooks/use-auth";

export default function AppLayout() {
	const { isAuthenticated, isLoading } = useAuth();

	if (isLoading) {
		return null;
	}

	if (!isAuthenticated) {
		return <Redirect href="/(auth)/sign-in" />;
	}

	return (
		<AuthGate>
			<Tabs screenOptions={{ headerShown: false }}>
				<Tabs.Screen
					name="index"
					options={{
						title: "Home",
						tabBarLabel: "Home",
						tabBarIcon: ({ color, size }) => (
							<Ionicons name="home-outline" size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="profile"
					options={{
						title: "Profile",
						tabBarLabel: "Profile",
						tabBarIcon: ({ color, size }) => (
							<Ionicons name="person-outline" size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="settings"
					options={{
						title: "Settings",
						tabBarLabel: "Settings",
						tabBarIcon: ({ color, size }) => (
							<Ionicons name="settings-outline" size={size} color={color} />
						),
					}}
				/>
			</Tabs>
		</AuthGate>
	);
}
