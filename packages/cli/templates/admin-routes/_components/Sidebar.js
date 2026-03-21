import { getModels, modelToSlug } from "@techstream/quark-admin";
import { QuarkLogo } from "@techstream/quark-ui";
import AdminThemeToggle from "./AdminThemeToggle";
import SignOutButton from "./SignOutButton";

export default function Sidebar() {
	const models = getModels();

	return (
		<aside className="w-56 shrink-0 bg-gray-50 dark:bg-[#0d1117] border-r border-gray-200 dark:border-[#1e2535] p-4 flex flex-col">
			<div className="mb-6 flex items-center gap-2">
				<QuarkLogo size={24} />
				<a
					href="/admin"
					className="text-lg font-semibold text-gray-900 dark:text-[#e0e0e0] hover:text-gray-700 dark:hover:text-white"
				>
					Admin
				</a>
			</div>
			<nav className="flex-1 flex flex-col gap-1">
				{models.map((model) => {
					const slug = modelToSlug(model.name);
					return (
						<a
							key={model.name}
							href={`/admin/${slug}`}
							className="px-3 py-2 rounded text-sm text-gray-700 dark:text-[#6b7a99] hover:bg-gray-200 dark:hover:bg-[#1e2535] hover:text-gray-900 dark:hover:text-[#e0e0e0] transition-colors"
						>
							{model.name}
						</a>
					);
				})}
			</nav>
			<div className="border-t border-gray-200 dark:border-[#1e2535] pt-3 mt-3 flex flex-col gap-2">
				<div className="flex items-center justify-between px-3 py-1">
					<span className="text-xs text-gray-400 dark:text-[#4a4a6a]">
						Theme
					</span>
					<AdminThemeToggle />
				</div>
				<SignOutButton />
			</div>
		</aside>
	);
}
