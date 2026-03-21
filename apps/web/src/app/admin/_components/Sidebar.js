import { getModels, modelToSlug } from "@techstream/quark-admin";
import SignOutButton from "./SignOutButton";

export default function Sidebar() {
	const models = getModels();

	return (
		<aside className="w-56 shrink-0 bg-gray-50 border-r border-gray-200 p-4 flex flex-col">
			<div className="mb-6">
				<a
					href="/admin"
					className="text-lg font-semibold text-gray-900 hover:text-gray-700"
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
							className="px-3 py-2 rounded text-sm text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-colors"
						>
							{model.name}
						</a>
					);
				})}
			</nav>
			<div className="border-t border-gray-200 pt-3 mt-3">
				<SignOutButton />
			</div>
		</aside>
	);
}
