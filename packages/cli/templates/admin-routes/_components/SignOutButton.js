"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
	return (
		<button
			type="button"
			onClick={() => signOut({ callbackUrl: "/" })}
			className="px-3 py-2 rounded text-sm text-gray-500 dark:text-[#4a4a6a] hover:bg-gray-200 dark:hover:bg-[#1e2535] hover:text-gray-900 dark:hover:text-[#e0e0e0] transition-colors text-left cursor-pointer"
		>
			Sign out
		</button>
	);
}
