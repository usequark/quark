import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasCrmFeature } from "@/lib/load-crm-config";
import SettingsTabs from "./_components/SettingsTabs";

export const metadata = {
	title: "Settings",
};

export default async function SettingsPage({ searchParams }) {
	const session = await auth();
	if (!session?.user) {
		redirect("/auth/signin?callbackUrl=/admin/settings");
	}

	const { tab } = await searchParams;
	const crmEnabled = await hasCrmFeature();

	return <SettingsTabs crmEnabled={crmEnabled} initialTab={tab} />;
}
