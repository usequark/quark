import { loadConfig } from "@usequark/quark-config";

export function isEmailVerificationRequired() {
	return loadConfig().auth.requireEmailVerification;
}
