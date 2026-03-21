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
	QuarkLogo,
} from "@techstream/quark-ui";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";

export default function RegisterPage() {
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
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(e) {
		e.preventDefault();
		setError("");
		setLoading(true);

		const res = await fetch("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password, name: name || undefined }),
		});

		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			setError(body.message || "Registration failed. Try again.");
			setLoading(false);
			return;
		}

		// Account created — sign in automatically
		const result = await signIn("credentials", {
			email,
			password,
			callbackUrl,
			redirect: false,
		});

		if (result?.error) {
			// Account was created but auto-signin failed — send to signin page
			window.location.href = "/auth/signin";
			return;
		}

		window.location.href = result?.url || "/";
	}

	return (
		<main className="quark-page-grid min-h-screen flex items-center justify-center px-4">
			<div className="w-full max-w-sm flex flex-col items-center gap-6">
				<QuarkLogo size={48} />
				<Card className="w-full">
					<CardHeader>
						<CardTitle>Create account</CardTitle>
					</CardHeader>

					<CardContent>
						{error && (
							<div className="mb-4 rounded border border-red-200 dark:border-[#ff4757]/30 bg-red-50 dark:bg-[#ff4757]/10 px-3 py-2 text-sm text-red-700 dark:text-[#ff4757]">
								{error}
							</div>
						)}

						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									type="text"
									autoComplete="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>

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
									autoComplete="new-password"
									required
									minLength={8}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
								<p className="text-xs text-gray-400 dark:text-[#4a4a6a]">
									Min 8 characters, with uppercase, lowercase, and a number.
								</p>
							</div>

							<Button
								type="submit"
								variant="primary"
								className="w-full"
								disabled={loading}
							>
								{loading ? "Creating account…" : "Create account"}
							</Button>
						</form>
					</CardContent>

					<CardFooter className="justify-center">
						<p className="text-sm text-gray-500 dark:text-[#6b7a99]">
							Already have an account?{" "}
							<a
								href="/auth/signin"
								className="text-blue-600 dark:text-[#377dff] hover:text-blue-800 dark:hover:text-[#377dff]/80 transition-colors"
							>
								Sign in
							</a>
						</p>
					</CardFooter>
				</Card>
			</div>
		</main>
	);
}
