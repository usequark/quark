import { access } from "node:fs/promises";
import path from "node:path";

import { adminConfig, getModels, modelToSlug } from "@techstream/quark-admin";
import { createLogger } from "@techstream/quark-core";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasCrmFeature } from "@/lib/load-crm-config";

const logger = createLogger("admin:layout");

const CMS_CONFIG_PATHS = [
	"packages/cms/src/config.js",
	"../../packages/cms/src/config.js",
	"../../../../../../packages/cms/src/config.js",
];

/**
 * Detect whether the CMS feature is present without importing
 * `@/lib/load-cms-config` (which only ships with the cms-public template).
 * Mirrors the fs-existence pattern used by `load-crm-config.js`.
 */
async function hasCmsFeature() {
	for (const relativePath of CMS_CONFIG_PATHS) {
		try {
			await access(path.resolve(process.cwd(), relativePath));
			return true;
		} catch {}
	}
	return false;
}

export const dynamic = "force-dynamic";
export const metadata = {
	title: {
		default: adminConfig.title,
		template: `%s · ${adminConfig.title}`,
	},
};

/**
 * Neutral Quark logo mark — plain gray ring+dash, deliberately not a design
 * statement. Rendered inline so the admin shell carries no themed UI.
 */
function QuarkLogoMark({ size = 24 }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 200 200"
			fill="none"
			width={size}
			height={size}
			aria-hidden="true"
			className="shrink-0"
		>
			<path
				d="M 35,100 A 65,65 0 0,1 165,100"
				stroke="#9ca3af"
				strokeWidth={26}
				strokeLinecap="butt"
			/>
			<path
				d="M 119.1,162.1 A 65,65 0 0,1 35,100"
				stroke="#d1d5db"
				strokeWidth={26}
				strokeLinecap="butt"
			/>
			<path
				d="M 165,100 A 65,65 0 0,1 161.5,121"
				stroke="#e5e7eb"
				strokeWidth={26}
				strokeLinecap="butt"
			/>
			<line
				x1={116.3}
				y1={116.8}
				x2={172}
				y2={174.2}
				stroke="#6b7280"
				strokeWidth={28}
				strokeLinecap="butt"
			/>
		</svg>
	);
}

export default async function AdminLayout({ children }) {
	const session = await auth();
	if (!session?.user) {
		redirect("/auth/signin?callbackUrl=/admin");
	}

	const role = session.user.role;
	const isAdminRole = role === "admin" || role === "client_admin";
	const cmsEnabled = await hasCmsFeature();
	const hasCrm = await hasCrmFeature();
	// Editors are admitted only when the CMS feature is present — they manage
	// content, not generic models (which require the admin role).
	if (!isAdminRole && (role !== "editor" || !cmsEnabled)) {
		redirect("/");
	}

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

	const coreModels = models.filter((m) => !m.readOnly);
	const systemModels = models.filter((m) => m.readOnly);

	// Set umami_user_role cookie so the Umami before-send handler in the root
	// layout can block analytics tracking for admin users on public pages.
	const umamiRoleScript = `document.cookie="umami_user_role=${role};path=/;max-age=28800;SameSite=Lax"`;

	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static inline umami role cookie */}
			<script dangerouslySetInnerHTML={{ __html: umamiRoleScript }} />
			<div className="flex h-screen bg-gray-100 overflow-hidden">
				<aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col">
					<div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200">
						<QuarkLogoMark />
						<Link
							href="/admin"
							className="text-sm font-semibold text-gray-900 hover:text-gray-600"
						>
							{adminConfig.title}
						</Link>
					</div>

					<nav className="flex-1 overflow-y-auto p-3 space-y-1">
						<SidebarLink href="/admin" label="Dashboard" exact />
						{cmsEnabled && (
							<>
								<SectionLabel label="Content" />
								<SidebarLink href="/admin/cms" label="Overview" exact />
								<SidebarLink href="/admin/cms/media" label="Media" />
							</>
						)}
						{hasCrm && (
							<>
								<SectionLabel label="CRM" />
								<SidebarLink href="/admin/crm" label="Overview" exact />
								<SidebarLink href="/admin/crm/deals" label="Deals" />
							</>
						)}
						{coreModels.length > 0 && (
							<SectionLabel label="Models" />
						)}
						{coreModels.map((m) => (
							<SidebarLink
								key={m.name}
								href={`/admin/${m.slug}`}
								label={m.label}
							/>
						))}
						{systemModels.length > 0 && (
							<SectionLabel label="System" />
						)}
						{systemModels.map((m) => (
							<SidebarLink
								key={m.name}
								href={`/admin/${m.slug}`}
								label={m.label}
							/>
						))}
					</nav>

					<div className="border-t border-gray-200 p-3">
						<Link
							href="/"
							className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
						>
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
									d="M10 19l-7-7m0 0l7-7m-7 7h18"
								/>
							</svg>
							Back to Home
						</Link>
					</div>
				</aside>
				<main className="flex-1 overflow-auto p-4 pt-14 lg:p-6 lg:pt-6">
					{children}
				</main>
			</div>
		</>
	);
}

function SectionLabel({ label }) {
	return (
		<p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
			{label}
		</p>
	);
}

function SidebarLink({ href, label, exact = false }) {
	return (
		<Link
			href={href}
			className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
		>
			{label}
		</Link>
	);
}
