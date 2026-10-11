"use client";

import { clearCsrfToken, getCsrfToken } from "@usequark/quark-core/csrf-client";
import {
	Button,
	ErrorBanner,
	Input,
	Label,
	QuarkLogo,
} from "@usequark/quark-ui";
import Link from "next/link";
import { useState } from "react";

/**
 * The forgot-password form.
 *
 * The POST answers identically whether or not the address exists (see the
 * route's enumeration note), so the client surface shows exactly one outcome:
 * "if that address has an account, a link is on its way." A success state and a
 * network-failure state, and deliberately nothing in between.
 */
export default function ForgotPasswordPageClient() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [sent, setSent] = useState(false);

	async function handleSubmit(e) {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			// Same pre-authentication CSRF handshake as the register page: fetch a
			// token from GET /api/csrf and send it alongside the matching cookie.
			let res = await postForgotPassword(await getCsrfToken());

			// A 401 usually means the server rotated the csrf_token cookie out
			// from under the cached token. Retry once with a fresh pair; a second
			// failure is a real failure and falls through to the banner.
			if (res.status === 401) {
				clearCsrfToken();
				res = await postForgotPassword(await getCsrfToken());
			}

			if (!res.ok && res.status !== 429) {
				const body = await res.json().catch(() => ({}));
				setError(body.message || "Something went wrong. Try again.");
				setLoading(false);
				return;
			}

			setSent(true);
			setLoading(false);
		} catch {
			setError("Could not reach the server. Try again.");
			setLoading(false);
		}
	}

	async function postForgotPassword(csrfToken) {
		return await fetch("/api/auth/forgot-password", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-CSRF-Token": csrfToken,
			},
			body: JSON.stringify({ email: email.trim() }),
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
					Reset your password.
				</h2>
				<p className="text-sm text-text-muted leading-relaxed">
					Enter your email and we will send you a link to recover access.
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
							Forgot password
						</h1>
					</div>

					<ErrorBanner message={error} />

					{sent ? (
						<>
							<p
								role="status"
								className="text-sm text-text-muted leading-relaxed mb-8"
							>
								If that email address has an account, a reset link is on its
								way. Check your inbox — the link expires after one hour.
							</p>
							<Link
								href="/auth/signin"
								className="text-xs text-text-muted hover:text-text transition-opacity duration-200 linear uppercase tracking-widest"
							>
								← Back to sign in
							</Link>
						</>
					) : (
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

							<Button
								type="submit"
								variant="primary"
								className="w-full mt-2"
								disabled={loading}
							>
								{loading ? "Sending…" : "Send reset link →"}
							</Button>

							<Link
								href="/auth/signin"
								className="block text-center text-xs text-text-muted hover:text-text transition-opacity duration-200 linear uppercase tracking-widest"
							>
								← Back to sign in
							</Link>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}
