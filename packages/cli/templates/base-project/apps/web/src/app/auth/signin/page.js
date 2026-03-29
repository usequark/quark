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

const ERROR_MESSAGES = {
	CredentialsSignin: "Invalid email or password.",
	CallbackRouteError: "Sign in failed. Check your connection and try again.",
	OAuthAccountNotLinked:
		"This email is already registered with a different provider.",
	OAuthSignin: "Could not start the sign-in flow. Try again.",
	OAuthCallback: "Authentication callback failed. Try again.",
	Default: "An unexpected error occurred. Try again.",
	Unauthorized: "You must sign in to access that page.",
};

export default function SignInPage() {
	return (
		<Suspense>
			<SignInForm />
		</Suspense>
	);
}

function SignInForm() {
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") || "/";
	const errorCode = searchParams.get("error");

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [rememberMe, setRememberMe] = useState(false);
	const [loading, setLoading] = useState(false);
	const [providers, setProviders] = useState(null);
	const [error, setError] = useState(
		errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default) : "",
	);

	useEffect(() => {
		fetch("/api/auth/providers")
			.then((r) => r.json())
			.then(setProviders)
			.catch(() => {});
	}, []);

	async function handleSubmit(e) {
		e.preventDefault();
		setError("");
		setLoading(true);

		const result = await signIn("credentials", {
			email: email.trim(),
			password,
			callbackUrl,
			redirect: false,
		});

		if (result?.error) {
			setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.Default);
			setLoading(false);
			return;
		}

		// Guard against undefined result (can happen with server-side auth errors in v5)
		if (!result?.url) {
			setError(ERROR_MESSAGES.Default);
			setLoading(false);
			return;
		}

		// Successful — use the server-validated URL from NextAuth (safe against open redirects)
		window.location.href = result.url;
	}

	function handleOAuth(provider) {
		signIn(provider, { callbackUrl });
	}

	return (
		<div className="quark-auth-layout">
			{/* ── Authority / branding panel ───────────────────────────── */}
			<div className="quark-auth-brand">
				<Link href="/" aria-label="Go to home">
					<QuarkLogo size={64} className="mb-8" />
				</Link>
				<p className="text-xs uppercase tracking-widest text-text-faint mb-3">
					Welcome back
				</p>
				<h2 className="text-3xl font-bold text-text leading-tight mb-4">
					Your work is waiting.
				</h2>
				<p className="text-sm text-text-muted leading-relaxed">
					Authenticate to access your workspace.
				</p>
			</div>

			{/* ── Form panel ───────────────────────────────────────────── */}
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
							Sign in
						</h1>
						<p className="text-xs uppercase tracking-widest text-text-muted mt-2">
							Enter your email and password.
						</p>
					</div>

					<ErrorBanner message={error} />

					<form onSubmit={handleSubmit} className="space-y-5">
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
							<div className="flex items-center justify-between">
								<Label htmlFor="password">Password</Label>
								<Link
									href="/auth/forgot-password"
									className="text-xs text-primary hover:opacity-75 transition-opacity duration-200 linear uppercase tracking-widest"
								>
									Forgot?
								</Link>
							</div>
							<Input
								id="password"
								type="password"
								autoComplete="current-password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>

						<div className="flex items-center gap-2">
							<input
								id="remember-me"
								type="checkbox"
								className="h-3.5 w-3.5 border border-border bg-surface accent-primary cursor-pointer"
								checked={rememberMe}
								onChange={(e) => setRememberMe(e.target.checked)}
							/>
							<label
								htmlFor="remember-me"
								className="text-xs uppercase tracking-widest text-text-muted cursor-pointer select-none"
							>
								Remember me
							</label>
						</div>

						<Button
							type="submit"
							variant="primary"
							className="w-full mt-2"
							disabled={loading}
						>
							{loading ? "Signing in…" : "Continue →"}
						</Button>
					</form>

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
						No account?{" "}
						<Link
							href="/auth/register"
							className="text-primary hover:opacity-75 transition-opacity duration-200 linear"
						>
							Sign up
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
