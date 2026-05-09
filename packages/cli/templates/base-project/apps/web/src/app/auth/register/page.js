import { redirect } from "next/navigation";

import { isSignupEnabled } from "@/lib/auth-signup";

import RegisterPageClient from "./RegisterPageClient";

export default function RegisterPage() {
	if (!isSignupEnabled()) {
		redirect("/auth/signin");
	}

	return <RegisterPageClient />;
}
