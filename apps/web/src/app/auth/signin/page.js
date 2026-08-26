import { isSignupEnabled } from "@/lib/auth-signup";
import SignInPageClient from "./SignInPageClient";

export const metadata = {
	title: "Sign In",
};

export default function SignInPage() {
	return <SignInPageClient allowSignup={isSignupEnabled()} />;
}
