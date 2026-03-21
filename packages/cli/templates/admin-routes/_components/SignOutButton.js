"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
	return (
		<button
			type="button"
			onClick={() => signOut({ callbackUrl: "/" })}
			className="px-3 py-2 rounded text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors text-left cursor-pointer"
		>
			Sign out
		</button>
	);
}
