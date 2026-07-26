import { adminConfig, getModels, modelToSlug } from "@techstream/quark-admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadCmsConfig } from "@/lib/load-cms-config";
import { hasCrmFeature } from "@/lib/load-crm-config";
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
	const crmEnabled = await hasCrmFeature();
	const role = session.user.role;
	const isAdminRole = role === "admin" || role === "client_admin";
	if (!isAdminRole && (role !== "editor" || !cmsConfig)) {
		redirect("/");
	}

	// Expose the user role to the Umami before-send handler via a cookie
	// so admin page views and admin user activity are excluded from analytics.
	const cookieStore = await cookies();
	cookieStore.set("umami_user_role", role, {
		path: "/",
		httpOnly: false,
		sameSite: "lax",
		maxAge: 60 * 60, // 1 hour — refreshed on every admin page visit
	});

	const cmsLinks = cmsConfig
		? Object.entries(cmsConfig.contentTypes).map(([model, cfg]) => ({
				href: `/admin/cms/${model.toLowerCase()}s`,
				label: cfg.label,
			}))
		: [];

	const customLinks = crmEnabled
		? [
				{
					href: "/admin/crm",
					label: "CRM",
					icon: (
						<svg
							aria-hidden="true"
							className="w-4 h-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
							/>
						</svg>
					),
				},
			]
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
				customLinks={customLinks}
				contentLinks={cmsLinks}
				userRole={role}
			/>
			<main className="flex-1 overflow-auto p-4 pt-14 lg:p-6 lg:pt-6">
				{children}
			</main>
		</div>
	);
}
