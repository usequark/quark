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
					<CardTitle>Create account</CardTitle>
				</CardHeader>

				<CardContent>
					{error && (
						<div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
							<p className="text-xs text-gray-400">
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
					<p className="text-sm text-gray-500">
						Already have an account?{" "}
						<a
							href="/auth/signin"
							className="text-blue-600 hover:text-blue-800 transition-colors"
						>
							Sign in
						</a>
					</p>
				</CardFooter>
			</Card>
		</main>
	);
}
