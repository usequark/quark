"use client";

import {
	Button,
	ErrorBanner,
	Input,
	Label,
	PasswordInput,
	QuarkLogo,
} from "@usequark/quark-ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { loadAuthProviders } from "../provider-loading";

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

export default function SignInPageClient({ allowSignup }) {
	return (
		<Suspense>
			<SignInForm allowSignup={allowSignup} />
		</Suspense>
	);
}

function SignInForm({ allowSignup }) {
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") || "/";
	const errorCode = searchParams.get("error");

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [providers, setProviders] = useState(null);
	const [providerError, setProviderError] = useState("");
	const [error, setError] = useState(
		errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default) : "",
	);

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

		if (!result?.url) {
			setError(ERROR_MESSAGES.Default);
			setLoading(false);
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
					Welcome back
				</p>
				<h2 className="text-3xl font-bold text-text leading-tight mb-4">
					Your work is waiting.
				</h2>
				<p className="text-sm text-text-muted leading-relaxed">
					Authenticate to access your workspace.
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
							<PasswordInput
								id="password"
								autoComplete="current-password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
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

					{allowSignup ? (
						<p className="mt-8 text-xs text-text-muted uppercase tracking-widest">
							No account?{" "}
							<Link
								href="/auth/register"
								className="text-primary hover:opacity-75 transition-opacity duration-200 linear"
							>
								Sign up
							</Link>
						</p>
					) : null}
				</div>
			</div>
		</div>
	);
}
