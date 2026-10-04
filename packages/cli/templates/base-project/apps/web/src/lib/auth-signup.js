import { loadConfig } from "@usequark/quark-config";

export function isSignupEnabled() {
	return loadConfig().auth.allowSignup;
}
