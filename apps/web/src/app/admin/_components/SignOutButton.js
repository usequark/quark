"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
	return (
		<button
			type="button"
			onClick={() => signOut({ callbackUrl: "/" })}
			className="px-3 py-2 rounded-[--radius-default] text-sm text-text-faint hover:bg-surface-hover hover:text-text transition-colors text-left cursor-pointer"
		>
			Sign out
		</button>
	);
}
