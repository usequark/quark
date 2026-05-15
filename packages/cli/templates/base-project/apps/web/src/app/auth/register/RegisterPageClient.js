"use client";

import {
	Button,
	ErrorBanner,
	Input,
	Label,
	QuarkLogo,
} from "@techstream/quark-ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { loadAuthProviders } from "../provider-loading";

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

export default function RegisterPageClient() {
	return (
		<Suspense>
			<RegisterForm />
		</Suspense>
	);
}

function RegisterForm() {
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") || "/";

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [loading, setLoading] = useState(false);
	const [providers, setProviders] = useState(null);
	const [providerError, setProviderError] = useState("");
	const [error, setError] = useState("");
	const strength = getPasswordStrength(password);

	useEffect(() => {
		let cancelled = false;

		void loadAuthProviders().then(({ providers: loadedProviders, error }) => {
			if (cancelled) {
				return;
			}

			setProviders(loadedProviders);
			setProviderError(error);
		});

		return () => {
			cancelled = true;
		};
	}, []);

	function validatePassword(value) {
		if (getPasswordStrength(value) < 3) {
			return "Must be 8+ characters with uppercase, lowercase, and a number.";
		}
		return "";
	}

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

		const res = await fetch("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: email.trim(),
				password,
				name: name.trim() || undefined,
			}),
		});

		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			setError(body.message || "Registration failed. Try again.");
			setLoading(false);
			return;
		}

		const result = await signIn("credentials", {
			email: email.trim(),
			password,
			callbackUrl,
			redirect: false,
		});

		if (result?.error) {
			window.location.href = "/auth/signin";
			return;
		}

		if (!result?.url) {
			window.location.href = "/";
			return;
		}

		window.location.href = result.url;
	}

	function handleOAuth(provider) {
		signIn(provider, { callbackUrl });
	}

	return (
		<div className="quark-auth-layout">
			<div className="quark-auth-brand">
				<Link href="/" aria-label="Go to home">
					<QuarkLogo size={64} className="mb-8" />
				</Link>
				<p className="text-xs uppercase tracking-widest text-text-faint mb-3">
					Get started
				</p>
				<h2 className="text-3xl font-bold text-text leading-tight mb-4">
					Everything you need,
					<br />
					ready in seconds.
				</h2>
				<p className="text-sm text-text-muted leading-relaxed">
					No credit card required. No setup complexity.
				</p>
			</div>

			<div className="quark-auth-form">
				<div className="flex md:hidden mb-8">
					<Link href="/" aria-label="Go to home">
						<QuarkLogo size={44} />
					</Link>
				</div>

				<div className="quark-auth-panel w-full max-w-sm">
					<div className="mb-8">
						<h1 className="text-2xl font-bold tracking-tight text-text">
							Create account
						</h1>
						<p className="text-xs uppercase tracking-widest text-text-muted mt-2">
							Fill in the details below.
						</p>
					</div>

					<ErrorBanner message={error} />

					<form onSubmit={handleSubmit} className="space-y-5">
						<div className="space-y-2">
							<Label htmlFor="name">
								Name{" "}
								<span className="text-text-faint font-normal normal-case tracking-normal">
									(optional)
								</span>
							</Label>
							<Input
								id="name"
								type="text"
								autoComplete="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
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
							<ul className="space-y-0.5">
								{[
									{
										test: password.length >= 8,
										label: "At least 8 characters",
									},
									{
										test: /[a-z]/.test(password) && /[A-Z]/.test(password),
										label: "Uppercase & lowercase",
									},
									{ test: /\d/.test(password), label: "One number" },
								].map(({ test, label }) => (
									<li
										key={label}
										className={`text-xs uppercase tracking-widest ${test ? "text-success" : "text-text-faint"}`}
									>
										{test ? "✓" : "·"} {label}
									</li>
								))}
							</ul>
						</div>

						<div className="space-y-2">
							<Label htmlFor="confirm-password">Confirm password</Label>
							<Input
								id="confirm-password"
								type="password"
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
							{loading ? "Creating account…" : "Get started →"}
						</Button>
					</form>

					{providerError ? (
						<p className="mt-4 text-xs uppercase tracking-widest text-text-muted">
							{providerError}
						</p>
					) : null}

					{providers?.github || providers?.google ? (
						<>
							<div className="mt-6 flex items-center gap-3">
								<hr className="flex-1 border-border" />
								<span className="text-xs text-text-muted uppercase tracking-widest">
									or
								</span>
								<hr className="flex-1 border-border" />
							</div>

							<div className="mt-4 flex flex-col gap-2">
								{providers.github && (
									<Button
										variant="secondary"
										className="w-full"
										onClick={() => handleOAuth("github")}
									>
										Continue with GitHub
									</Button>
								)}
								{providers.google && (
									<Button
										variant="secondary"
										className="w-full"
										onClick={() => handleOAuth("google")}
									>
										Continue with Google
									</Button>
								)}
							</div>
						</>
					) : null}

					<p className="mt-8 text-xs text-text-muted uppercase tracking-widest">
						Already have an account?{" "}
						<Link
							href="/auth/signin"
							className="text-primary hover:opacity-75 transition-opacity duration-200 linear"
						>
							Sign in
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
