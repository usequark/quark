"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton({ collapsed = false }) {
	return (
		<button
			type="button"
			onClick={() => signOut({ callbackUrl: "/" })}
			className="flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm text-text-faint hover:bg-surface-hover hover:text-text transition-all duration-150 text-left cursor-pointer"
			title={collapsed ? "Sign out" : undefined}
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
					d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
				/>
			</svg>
			<span
				className={`whitespace-nowrap transition-opacity duration-200 ${
					collapsed ? "opacity-0" : "opacity-100"
				}`}
			>
				Sign out
			</span>
		</button>
	);
}
