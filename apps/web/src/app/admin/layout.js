import { adminConfig, getModels, modelToSlug } from "@techstream/quark-admin";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadCmsConfig } from "@/lib/load-cms-config";
import Sidebar from "./_components/Sidebar";

export const dynamic = "force-dynamic";
export const metadata = {
	title: {
		default: adminConfig.title,
		template: `%s · ${adminConfig.title}`,
	},
};

export default async function AdminLayout({ children }) {
	const session = await auth();
	if (!session?.user) {
		redirect("/auth/signin?callbackUrl=/admin");
	}

	const cmsConfig = await loadCmsConfig();
	const role = session.user.role;
	if (role !== "admin" && (role !== "editor" || !cmsConfig)) {
		redirect("/");
	}

	const cmsLinks = cmsConfig
		? Object.entries(cmsConfig.contentTypes).map(([model, cfg]) => ({
				href: `/admin/cms/${model.toLowerCase()}s`,
				label: cfg.label,
			}))
		: [];

	const models = getModels().map((m) => ({
		name: m.name,
		slug: modelToSlug(m.name),
		label: adminConfig.modelOverrides[m.name]?.label ?? m.name,
		readOnly: !!adminConfig.modelOverrides[m.name]?.readOnly,
	}));

	return (
		<div className="flex h-screen bg-bg overflow-hidden">
			<Sidebar
				hasCms={Boolean(cmsConfig)}
				title={adminConfig.title}
				models={models}
				contentLinks={cmsLinks}
				userRole={role}
			/>
			<main className="flex-1 overflow-auto p-4 pt-14 lg:p-6 lg:pt-6">
				{children}
			</main>
		</div>
	);
}
