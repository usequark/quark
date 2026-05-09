import { isSignupEnabled } from "@/lib/auth-signup";
import SignInPageClient from "./SignInPageClient";

export default function SignInPage() {
	return <SignInPageClient allowSignup={isSignupEnabled()} />;
}
