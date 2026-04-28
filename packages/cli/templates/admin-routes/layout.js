import { adminConfig, getModels, modelToSlug } from "@techstream/quark-admin";
import { cmsConfig } from "@techstream/quark-cms";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Sidebar from "./_components/Sidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

// CMS content type links for the sidebar, derived from cmsConfig.
const cmsLinks = Object.entries(cmsConfig.contentTypes).map(([model, cfg]) => ({
	href: `/admin/cms/${model.toLowerCase()}s`,
	label: cfg.label,
}));

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
			<Sidebar
				title={adminConfig.title}
				models={models}
				contentLinks={cmsLinks}
			/>
			<main className="flex-1 overflow-auto p-4 pt-14 sm:p-6 sm:pt-6">
				{children}
			</main>
		</div>
	);
}
