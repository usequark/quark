import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
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
					<CardTitle>Authentication Error</CardTitle>
				</CardHeader>

				<CardContent>
					<div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
						{message}
					</div>
				</CardContent>

				<CardFooter className="justify-center">
					<a
						href="/auth/signin"
						className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
					>
						← Back to sign in
					</a>
				</CardFooter>
			</Card>
		</main>
	);
}
