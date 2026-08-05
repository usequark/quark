import { adminConfig, getModels, modelToSlug } from "@techstream/quark-admin";
import { createLogger } from "@techstream/quark-core";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadCmsConfig } from "@/lib/load-cms-config";
import { hasCrmFeature } from "@/lib/load-crm-config";
import Sidebar from "./_components/Sidebar";

const logger = createLogger("admin:layout");

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

	const cmsLinks = cmsConfig
		? Object.entries(cmsConfig.contentTypes).map(([model, cfg]) => ({
				href: `/admin/cms/${model.toLowerCase()}s`,
				label: cfg.label,
			}))
		: [];

	const customLinks = [
		...(crmEnabled
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
			: []),
		{
			href: "/admin/workflows",
			label: "Workflows",
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
						d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
					/>
				</svg>
			),
		},
		{
			href: "/admin/settings",
			label: "Settings",
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
						d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
					/>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			),
		},
	];

	let models = [];
	try {
		models = getModels().map((m) => ({
			name: m.name,
			slug: modelToSlug(m.name),
			label: adminConfig.modelOverrides[m.name]?.label ?? m.name,
			readOnly: !!adminConfig.modelOverrides[m.name]?.readOnly,
		}));
	} catch (error) {
		logger.error("failed to load models for sidebar", {
			error: error.message,
		});
	}

	// Set umami_user_role cookie so the Umami before-send handler in the root
	// layout can block analytics tracking for admin users on public pages.
	const umamiRoleScript = `document.cookie="umami_user_role=${role};path=/;max-age=28800;SameSite=Lax"`;

	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static inline umami role cookie */}
			<script dangerouslySetInnerHTML={{ __html: umamiRoleScript }} />
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
		</>
	);
}
