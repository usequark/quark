import { QuarkLogo } from "@usequark/quark-ui";
import Link from "next/link";

export const metadata = {
	title: "Auth Error",
};

const ERROR_MESSAGES = {
	Configuration: "There is a problem with the server configuration.",
	AccessDenied: "Access denied. You do not have permission to sign in.",
	Verification: "The verification link has expired or has already been used.",
	CredentialsSignin: "Invalid email or password.",
	OAuthAccountNotLinked:
		"This email is already associated with another sign-in method.",
	OAuthSignin: "Could not start the sign-in flow.",
	OAuthCallback: "Authentication callback failed.",
	Default: "An unexpected error occurred.",
};

export default async function AuthErrorPage({ searchParams }) {
	const params = await searchParams;
	const raw = params?.error;
	// NextAuth sometimes passes the literal string "undefined" - normalise it.
	const errorCode = !raw || raw === "undefined" ? "Default" : raw;
	const message = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default;

	return (
		<div className="quark-auth-layout">
			{/* Authority / branding panel */}
			<div className="quark-auth-brand">
				<Link href="/" aria-label="Go to home">
					<QuarkLogo size={64} className="mb-8" />
				</Link>
				<p className="text-xs uppercase tracking-widest text-text-faint mb-3">
					Authentication
				</p>
				<h2 className="text-3xl font-bold text-text leading-tight mb-4">
					Something went wrong.
				</h2>
				<p className="text-sm text-text-muted leading-relaxed">
					An error occurred during authentication.
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
							Authentication error
						</h1>
						{errorCode !== "Default" && (
							<p className="text-xs uppercase tracking-widest text-text-muted mt-2">
								Error code: {errorCode}
							</p>
						)}
					</div>

					<div
						role="alert"
						className="border border-danger/40 bg-danger-muted px-4 py-3 text-sm text-danger mb-8"
					>
						{message}
					</div>

					<Link
						href="/auth/signin"
						className="text-xs text-text-muted hover:text-text transition-opacity duration-200 linear uppercase tracking-widest"
					>
						← Back to sign in
					</Link>
				</div>
			</div>
		</div>
	);
}
