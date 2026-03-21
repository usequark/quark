"use client";

import {
	Button,
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
	Input,
	Label,
} from "@techstream/quark-ui";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";

const ERROR_MESSAGES = {
	CredentialsSignin: "Invalid email or password.",
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
			email,
			password,
			callbackUrl,
			redirect: false,
		});

		if (result?.error) {
			setError(ERROR_MESSAGES.CredentialsSignin);
			setLoading(false);
			return;
		}

		// Successful — use the server-validated URL from NextAuth (safe against open redirects)
		window.location.href = result?.url || "/";
	}

	function handleOAuth(provider) {
		signIn(provider, { callbackUrl });
	}

	return (
		<main
			className="min-h-screen flex items-center justify-center px-4"
			style={{
				backgroundColor: "#f7f8fa",
				backgroundImage:
					"linear-gradient(rgba(0,0,0,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.07) 1px, transparent 1px)",
				backgroundSize: "40px 40px",
			}}
		>
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Sign in</CardTitle>
				</CardHeader>

				<CardContent>
					{error && (
						<div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1.5">
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

						<div className="space-y-1.5">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								autoComplete="current-password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>

						<Button
							type="submit"
							variant="primary"
							className="w-full"
							disabled={loading}
						>
							{loading ? "Signing in…" : "Sign in"}
						</Button>
					</form>

					{providers?.github || providers?.google ? (
						<>
							<div className="mt-4 flex items-center gap-3">
								<hr className="flex-1 border-gray-200" />
								<span className="text-xs text-gray-400 uppercase tracking-wide">
									or
								</span>
								<hr className="flex-1 border-gray-200" />
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
				</CardContent>

				<CardFooter className="flex-col gap-2">
					<p className="text-sm text-gray-500">
						Don&apos;t have an account?{" "}
						<a
							href="/auth/register"
							className="text-blue-600 hover:text-blue-800 transition-colors"
						>
							Sign up
						</a>
					</p>
					<a
						href="/"
						className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
					>
						← Back to home
					</a>
				</CardFooter>
			</Card>
		</main>
	);
}
