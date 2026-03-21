import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
	QuarkLogo,
} from "@techstream/quark-ui";

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
	const errorCode = params?.error || "Default";
	const message = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default;

	return (
		<main className="quark-page-grid min-h-screen flex items-center justify-center px-4">
			<div className="w-full max-w-sm flex flex-col items-center gap-6">
				<QuarkLogo size={48} />
				<Card className="w-full">
					<CardHeader>
						<CardTitle>Authentication Error</CardTitle>
					</CardHeader>

					<CardContent>
						<div className="rounded border border-red-200 dark:border-[#ff4757]/30 bg-red-50 dark:bg-[#ff4757]/10 px-3 py-2 text-sm text-red-700 dark:text-[#ff4757]">
							{message}
						</div>
					</CardContent>

					<CardFooter className="justify-center">
						<a
							href="/auth/signin"
							className="text-sm text-gray-500 dark:text-[#6b7a99] hover:text-gray-700 dark:hover:text-[#e0e0e0] transition-colors"
						>
							← Back to sign in
						</a>
					</CardFooter>
				</Card>
			</div>
		</main>
	);
}
