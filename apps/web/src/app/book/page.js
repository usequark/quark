import { prisma } from "@techstream/quark-db";
import {
	Button,
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
	Footer,
	MobileNavbar,
	Navbar,
} from "@techstream/quark-ui";
import { bookLane, getBookedSlots } from "./_actions/book.js";
import BookingForm from "./_components/BookingForm.js";

export const metadata = {
	title: "Book a Lane - Batting Cage",
	description:
		"Reserve your batting cage lane. Choose from Hack Attack Machine, Tee Lane, 3 Wheel Machine, or Pitching Lane.",
};

const NAV_LINKS = [
	{ label: "Home", href: "/" },
	{ label: "Example Page", href: "/example-page" },
	{ label: "Playground", href: "/playground" },
	{ label: "Book a Lane", href: "/book" },
];

const FOOTER_COLUMNS = [
	{
		title: "Quick Links",
		links: [
			{ label: "Home", href: "/" },
			{ label: "Book a Lane", href: "/book" },
			{ label: "Example Page", href: "/example-page" },
			{ label: "Playground", href: "/playground" },
		],
	},
	{
		title: "Lane Types",
		links: [
			{ label: "Hack Attack Machine" },
			{ label: "Tee Lane" },
			{ label: "3 Wheel Machine" },
			{ label: "Pitching Lane" },
		],
	},
	{
		title: "Resources",
		links: [
			{
				label: "Quark Core",
				href: "https://www.npmjs.com/package/@techstream/quark-core",
			},
			{
				label: "CLI",
				href: "https://www.npmjs.com/package/@techstream/quark-create-app",
			},
			{ label: "GitHub", href: "https://github.com/Bobnoddle/quark" },
		],
	},
];

export default async function BookPage({ searchParams }) {
	const params = await searchParams;
	const isBooked = params?.booked === "true";

	const services = await prisma.serviceType.findMany({
		where: { active: true },
		orderBy: { name: "asc" },
	});

	return (
		<div className="min-h-screen bg-bg text-text">
			<div className="sticky top-0 z-50 hidden md:block">
				<Navbar
					logo="Cage"
					logoHref="/"
					links={NAV_LINKS}
					action={{ label: "Book a Lane", href: "/book" }}
					maxWidthClassName="max-w-7xl"
				/>
			</div>
			<div className="sticky top-0 z-50 md:hidden">
				<MobileNavbar
					logo="Cage"
					logoHref="/"
					links={NAV_LINKS}
					action={{ label: "Book", href: "/book" }}
					maxWidthClassName="max-w-7xl"
				/>
			</div>

			<main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
				{isBooked ? (
					<div className="mx-auto max-w-lg">
						<Card className="border-border/80 bg-surface/95 shadow-[0_12px_45px_rgba(0,0,0,0.18)]">
							<CardHeader className="space-y-4 text-center pt-10">
								<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success-muted">
									<svg
										className="h-8 w-8 text-success"
										viewBox="0 0 20 20"
										fill="currentColor"
										aria-hidden="true"
									>
										<path
											fillRule="evenodd"
											d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
											clipRule="evenodd"
										/>
									</svg>
								</div>
								<CardTitle className="text-2xl text-text sm:text-3xl">
									Booking Confirmed!
								</CardTitle>
							</CardHeader>
							<CardContent className="text-center space-y-3 pb-8">
								<p className="text-text-muted max-w-md mx-auto">
									Your lane reservation has been booked. You'll receive a
									confirmation email shortly.
								</p>
								<p className="text-sm text-text-faint">
									Please arrive 5-10 minutes early. Helmets and bats are
									available at the counter.
								</p>
							</CardContent>
							<CardFooter className="flex flex-wrap justify-center gap-3 pb-8">
								<Button href="/book" variant="solid">
									Book Another Lane
								</Button>
								<Button href="/" variant="secondary">
									Back to Home
								</Button>
							</CardFooter>
						</Card>
					</div>
				) : (
					<div className="space-y-10">
						<div className="relative overflow-hidden rounded-[--radius-default] border border-border/80 bg-surface shadow-[0_12px_45px_rgba(0,0,0,0.18)]">
							<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary to-primary/30" />
							<div className="px-6 py-8 sm:px-8 sm:py-10">
								<BookingForm
									services={services}
									action={bookLane}
									getBookedSlots={getBookedSlots}
								/>
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-3">
							{[
								{
									icon: (
										<svg
											className="h-5 w-5"
											viewBox="0 0 20 20"
											fill="currentColor"
											aria-hidden="true"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
												clipRule="evenodd"
											/>
										</svg>
									),
									title: "Flexible Sessions",
									desc: "Book 30 min to 2 hours. Pay only for the time you need.",
								},
								{
									icon: (
										<svg
											className="h-5 w-5"
											viewBox="0 0 20 20"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zm5 2a2 2 0 11-4 0 2 2 0 014 0zm-4 7a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zm10 10v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
										</svg>
									),
									title: "All Skill Levels",
									desc: "From beginners to pros. Coaching available on request.",
								},
								{
									icon: (
										<svg
											className="h-5 w-5"
											viewBox="0 0 20 20"
											fill="currentColor"
											aria-hidden="true"
										>
											<path
												fillRule="evenodd"
												d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
												clipRule="evenodd"
											/>
										</svg>
									),
									title: "Equipment Provided",
									desc: "Helmets, bats, and balls included. Just bring yourself.",
								},
							].map((item) => (
								<Card
									key={item.title}
									className="border-border/60 bg-surface/80"
								>
									<CardContent className="flex gap-4 pt-6">
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
											{item.icon}
										</div>
										<div className="space-y-1">
											<p className="font-semibold text-text">{item.title}</p>
											<p className="text-sm text-text-muted">{item.desc}</p>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				)}
			</main>

			<Footer
				brandName="Batting Cage"
				brandDescription="Book your preferred batting cage lane online. Walk-ins welcome, but reservations are guaranteed."
				ctaLabel="Book a Lane"
				ctaHref="/book"
				columns={FOOTER_COLUMNS}
				copyrightText="Copyright 2026 Batting Cage"
				legalLinks={[
					{ label: "Home", href: "/" },
					{ label: "Book", href: "/book" },
				]}
				poweredByText="Powered by Quark"
				poweredByHref="https://www.npmjs.com/package/@techstream/quark-create-app"
				mark={
					<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-muted text-sm font-semibold text-primary sm:h-12 sm:w-12">
						BC
					</span>
				}
			/>
		</div>
	);
}
