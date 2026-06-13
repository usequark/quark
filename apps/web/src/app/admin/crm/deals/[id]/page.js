import { prisma } from "@techstream/quark-db";
import { Card, CardContent } from "@techstream/quark-ui";
import { notFound } from "next/navigation";
import DealForm from "../../_components/DealForm";

export const metadata = { title: "Edit Deal" };

export default async function EditDealPage({ params }) {
	const { id } = await params;

	const [deal, contacts, companies] = await Promise.all([
		prisma.deal.findUnique({ where: { id } }),
		prisma.contact.findMany({
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				firstName: true,
				lastName: true,
				company: { select: { name: true } },
			},
		}),
		prisma.company.findMany({
			orderBy: { name: "asc" },
			select: { id: true, name: true },
		}),
	]);

	if (!deal) notFound();

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-bold tracking-tight text-text">
						Edit Deal
					</h1>
					<p className="mt-0.5 text-sm text-text-faint">{deal.title}</p>
				</div>
				<Link
					href="/admin/crm/deals"
					className="text-sm text-primary hover:opacity-75"
				>
					&larr; Back to deals
				</Link>
			</div>

			<Card>
				<CardContent className="p-6">
					<DealForm deal={deal} contacts={contacts} companies={companies} />
				</CardContent>
			</Card>
		</div>
	);
}
