import { loadConfig } from "@techstream/quark-config";

export function isSignupEnabled() {
	return loadConfig().auth.allowSignup;
}
