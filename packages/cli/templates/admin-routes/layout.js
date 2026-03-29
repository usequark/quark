import { adminConfig, getModels, modelToSlug } from "@techstream/quark-admin";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Sidebar from "./_components/Sidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }) {
	const session = await auth();
	if (!session?.user) {
		redirect("/auth/signin?callbackUrl=/admin");
	}
	if (session.user.role !== "admin") {
		redirect("/");
	}

	const models = getModels().map((m) => ({
		name: m.name,
		slug: modelToSlug(m.name),
		label: adminConfig.modelOverrides[m.name]?.label ?? m.name,
		readOnly: !!adminConfig.modelOverrides[m.name]?.readOnly,
	}));

	return (
		<div className="flex h-screen bg-bg overflow-hidden">
			<Sidebar title={adminConfig.title} models={models} />
			<main className="flex-1 overflow-auto p-4 pt-14 sm:p-6 sm:pt-6">
				{children}
			</main>
		</div>
	);
}
