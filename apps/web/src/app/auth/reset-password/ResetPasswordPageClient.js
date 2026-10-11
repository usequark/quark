"use client";

import { clearCsrfToken, getCsrfToken } from "@usequark/quark-core/csrf-client";
import {
	Button,
	ErrorBanner,
	Label,
	PasswordInput,
	QuarkLogo,
} from "@usequark/quark-ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = [
	"",
	"bg-danger",
	"bg-warning",
	"bg-primary",
	"bg-success",
];

function getPasswordStrength(value) {
	if (!value) return 0;
	let score = 0;
	if (value.length >= 8) score++;
	if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
	if (/\d/.test(value)) score++;
	if (/[^a-zA-Z0-9]/.test(value)) score++;
	return score;
}

function validatePassword(value) {
	if (getPasswordStrength(value) < 3) {
		return "Must be 8+ characters with uppercase, lowercase, and a number.";
	}
	return "";
}

export default function ResetPasswordPageClient() {
	return (
		<Suspense>
			<ResetPasswordForm />
		</Suspense>
	);
}

function ResetPasswordForm() {
	const searchParams = useSearchParams();
	const token = searchParams.get("token") || "";

	// `invalid` means the link is unusable (missing, expired, consumed).
	// `error` means the validity check itself failed and the form stays down
	// rather than letting a user type a new password into a form that might not
	// work.
	const [linkState, setLinkState] = useState("checking");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);
	const strength = getPasswordStrength(password);

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			try {
				const res = await fetch(
					`/api/auth/reset-password?token=${encodeURIComponent(token)}`,
				);
				if (!cancelled) {
					setLinkState(res.ok ? "ready" : "invalid");
				}
			} catch {
				if (!cancelled) setLinkState("error");
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [token]);

	async function handleSubmit(e) {
		e.preventDefault();
		setError("");

		const pwdErr = validatePassword(password);
		if (pwdErr) {
			setPasswordError(pwdErr);
			return;
		}

		if (password !== confirmPassword) {
			setPasswordError("Passwords do not match.");
			return;
		}

		setPasswordError("");
		setLoading(true);

		try {
			let res = await postReset(await getCsrfToken());

			if (res.status === 401) {
				clearCsrfToken();
				res = await postReset(await getCsrfToken());
			}

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				setError(body.message || "Reset failed. Try again.");
				setLoading(false);
				return;
			}

			setDone(true);
			setLoading(false);
		} catch {
			setError("Could not reach the server. Try again.");
			setLoading(false);
		}
	}

	async function postReset(csrfToken) {
		return await fetch("/api/auth/reset-password", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-CSRF-Token": csrfToken,
			},
			body: JSON.stringify({ token, password }),
		});
	}

	return (
		<div className="quark-auth-layout">
			{/* Authority / branding panel */}
			<div className="quark-auth-brand">
				<Link href="/" aria-label="Go to home">
					<QuarkLogo size={64} className="mb-8" />
				</Link>
				<p className="text-xs uppercase tracking-widest text-text-faint mb-3">
					Account recovery
				</p>
				<h2 className="text-3xl font-bold text-text leading-tight mb-4">
					Choose a new password.
				</h2>
				<p className="text-sm text-text-muted leading-relaxed">
					Once set, every existing session is signed out — including any session
					the old password was signed in from.
				</p>
			</div>

			{/* Form panel */}
			<div className="quark-auth-form">
				{/* Mobile-only logo */}
				<div className="flex md:hidden mb-8">
					<Link href="/" aria-label="Go to home">
						<QuarkLogo size={44} />
					</Link>
				</div>

				<div className="quark-auth-panel w-full max-w-sm">
					<div className="mb-8">
						<h1 className="text-2xl font-bold tracking-tight text-text">
							Reset password
						</h1>
					</div>

					<ErrorBanner message={error} />

					{linkState === "checking" ? (
						<p className="text-sm text-text-muted leading-relaxed mb-8">
							Checking your link…
						</p>
					) : null}

					{linkState === "invalid" || linkState === "error" ? (
						<>
							<p className="text-sm text-text-muted leading-relaxed mb-8">
								This reset link is invalid or has expired. Request a new one
								from the forgot-password page.
							</p>
							<Link
								href="/auth/forgot-password"
								className="text-xs text-primary hover:opacity-75 transition-opacity duration-200 linear uppercase tracking-widest"
							>
								Request a new link
							</Link>
						</>
					) : null}

					{linkState === "ready" && !done ? (
						<form onSubmit={handleSubmit} className="space-y-5">
							<div className="space-y-2">
								<Label htmlFor="password">New password</Label>
								<PasswordInput
									id="password"
									autoComplete="new-password"
									required
									value={password}
									onChange={(e) => {
										setPassword(e.target.value);
										if (passwordError)
											setPasswordError(validatePassword(e.target.value));
									}}
								/>
								{password && (
									<div className="space-y-1">
										<div className="flex gap-0.5">
											{[1, 2, 3, 4].map((seg) => (
												<div
													key={seg}
													className={`h-0.5 flex-1 transition-colors duration-200 linear ${strength >= seg ? STRENGTH_COLORS[strength] : "bg-border"}`}
												/>
											))}
										</div>
										<p className="text-xs text-text-faint uppercase tracking-widest">
											{STRENGTH_LABELS[strength]}
										</p>
									</div>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="confirm-password">Confirm new password</Label>
								<PasswordInput
									id="confirm-password"
									autoComplete="new-password"
									required
									value={confirmPassword}
									onChange={(e) => {
										setConfirmPassword(e.target.value);
										if (passwordError) setPasswordError("");
									}}
								/>
								{passwordError ? (
									<p className="text-xs text-danger uppercase tracking-widest">
										{passwordError}
									</p>
								) : null}
							</div>

							<Button
								type="submit"
								variant="primary"
								className="w-full mt-2"
								disabled={loading}
							>
								{loading ? "Resetting…" : "Set new password →"}
							</Button>
						</form>
					) : null}

					{done ? (
						<>
							<p
								role="status"
								className="text-sm text-text-muted leading-relaxed mb-8"
							>
								Your password has been updated. All previous sessions have been
								signed out.
							</p>
							<Link
								href="/auth/signin"
								className="text-xs text-primary hover:opacity-75 transition-opacity duration-200 linear uppercase tracking-widest"
							>
								Sign in with your new password →
							</Link>
						</>
					) : null}
				</div>
			</div>
		</div>
	);
}
