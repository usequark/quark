import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Sidebar from "./_components/Sidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }) {
	const session = await auth();
	if (!session?.user) {
		redirect("/auth/signin?callbackUrl=/admin");
	}
	if (session.user.role !== "admin") {
		redirect("/");
	}

	return (
		<div className="flex min-h-screen bg-white">
			<Sidebar />
			<main className="flex-1 p-6 overflow-auto">{children}</main>
		</div>
	);
}
