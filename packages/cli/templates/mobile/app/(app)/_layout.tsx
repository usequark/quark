import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../hooks/use-auth";
import { AuthGate } from "../../components/AuthGate";

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
					}}
				/>
				<Tabs.Screen
					name="profile"
					options={{
						title: "Profile",
						tabBarLabel: "Profile",
					}}
				/>
				<Tabs.Screen
					name="settings"
					options={{
						title: "Settings",
						tabBarLabel: "Settings",
					}}
				/>
			</Tabs>
		</AuthGate>
	);
}
