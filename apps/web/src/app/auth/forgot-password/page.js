import { QuarkLogo } from "@techstream/quark-ui";
import Link from "next/link";

export const metadata = {
	title: "Forgot Password",
};

export default function ForgotPasswordPage() {
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

					<p className="text-sm text-text-muted leading-relaxed mb-8">
						Password reset is not available. Please contact support for help
						accessing your account.
					</p>

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
