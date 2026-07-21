import bcrypt from "bcryptjs";
import { prisma } from "../src/index.js";

/**
 * Minimal seed: creates a single admin user.
 * Used standalone in production initial setup (SEED_PROFILE=minimal).
 * Also called by seedDev to avoid duplication.
 *
 * Required env vars:
 *   ADMIN_PASSWORD - min 12 characters, no default (generate: openssl rand -base64 24)
 * Optional env vars:
 *   ADMIN_EMAIL    - defaults to admin@example.com
 *   ADMIN_NAME     - defaults to Admin
 */
async function seedMinimal(prisma) {
	const seedProfile = process.env.SEED_PROFILE || "dev";
	const adminEmail = process.env.ADMIN_EMAIL;
	const adminPassword = process.env.ADMIN_PASSWORD;
	const adminName = process.env.ADMIN_NAME || "Admin";

	if (!adminPassword) {
		throw new Error(
			"ADMIN_PASSWORD is required to seed the admin user.\n" +
				"  Set it in your .env file (minimum 12 characters).\n" +
				"  Generate one: openssl rand -base64 24",
		);
	}
	if (adminPassword.length < 12) {
		throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
	}

	if (!adminEmail && seedProfile === "minimal") {
		throw new Error(
			"ADMIN_EMAIL is required when SEED_PROFILE=minimal.\n" +
				"  Set it in your environment to the real admin email address.",
		);
	}

	const resolvedEmail = adminEmail || "admin@example.com";

	const existing = await prisma.user.findUnique({
		where: { email: resolvedEmail },
	});

	if (existing) {
		console.log("✓ Admin user already exists");
		return null;
	}

	const admin = await prisma.user.create({
		data: {
			email: resolvedEmail,
			name: adminName,
			role: "admin",
			password: await bcrypt.hash(adminPassword, 12),
		},
	});

	console.log(`✓ Created admin user: ${admin.email}`);
	return admin;
}

/**
 * Development seed: admin user + representative sample data for local testing.
 * Runs by default (SEED_PROFILE=dev).
 */
async function seedDev(prisma) {
	const admin = await seedMinimal(prisma);

	if (admin) {
		const sampleUser = await prisma.user.create({
			data: {
				email: "user@example.com",
				name: "Sample User",
				role: "viewer",
				image:
					"https://api.dicebear.com/7.x/avataaars/svg?seed=user@example.com",
			},
		});

		console.log(`✓ Created sample user: ${sampleUser.email}`);

		await prisma.auditLog.create({
			data: {
				userId: admin.id,
				action: "CREATE",
				entity: "User",
				entityId: sampleUser.id,
				metadata: { email: sampleUser.email, role: sampleUser.role },
			},
		});

		console.log("✓ Created sample audit log");

		await prisma.job.create({
			data: {
				queue: "default",
				name: "example-job",
				status: "COMPLETED",
				data: { message: "This is a sample job" },
				completedAt: new Date(),
			},
		});

		console.log("✓ Created sample job");
	}

	await seedBookingData(prisma);
}

async function seedBookingData(prisma) {
	const existing = await prisma.serviceType.count();
	if (existing > 0) {
		console.log("✓ Booking services already exist - skipping");
		return;
	}

	const laneTypes = [
		{
			name: "Hack Attack Machine",
			description:
				"High-velocity pitching machine that simulates real at-bats with adjustable speeds up to 90 mph.",
			duration: 30,
			price: 35.0,
			color: "#ef4444",
			capacity: 1,
		},
		{
			name: "Tee Lane",
			description:
				"Perfect for beginners and technique work. Adjustable tee height for all ages and skill levels.",
			duration: 30,
			price: 20.0,
			color: "#22c55e",
			capacity: 1,
		},
		{
			name: "3 Wheel Machine",
			description:
				"Three-wheel pitching machine delivering curveballs, sliders, and fastballs. Great for advanced training.",
			duration: 30,
			price: 40.0,
			color: "#3b82f6",
			capacity: 1,
		},
		{
			name: "Pitching Lane",
			description:
				"Full-length lane with mound and plate. Includes L-screen and radar gun. Bring your own catcher or use our target net.",
			duration: 30,
			price: 25.0,
			color: "#f59e0b",
			capacity: 1,
		},
	];

	const services = [];
	for (const data of laneTypes) {
		const service = await prisma.serviceType.create({ data });
		services.push(service);
		console.log(`✓ Created lane type: ${service.name}`);
	}

	const now = new Date();
	const slotsCreated = [];

	for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
		for (const service of services) {
			for (let h = 9; h < 21; h++) {
				for (const m of [0, 30]) {
					const start = new Date(now);
					start.setDate(start.getDate() + dayOffset);
					start.setHours(h, m, 0, 0);

					const end = new Date(start.getTime() + 30 * 60 * 1000);

					await prisma.availabilitySlot.create({
						data: {
							serviceId: service.id,
							slotScopeKey: service.id,
							startTime: start,
							endTime: end,
							capacity: 1,
						},
					});
					slotsCreated.push(true);
				}
			}
		}
	}

	console.log(
		`✓ Created ${slotsCreated.length} availability slots (7 days for 4 lanes)`,
	);
}

async function main() {
	// Guard: require an explicit SEED_PROFILE when seeding a remote database.
	// Without this, a missing SEED_PROFILE silently defaults to "dev" and seeds
	// sample data onto production or staging databases.
	if (!process.env.SEED_PROFILE) {
		const host = process.env.POSTGRES_HOST || "";
		const url = process.env.DATABASE_URL || "";
		const isRemote =
			(host && host !== "localhost" && host !== "127.0.0.1") ||
			(url && !url.includes("localhost") && !url.includes("127.0.0.1"));
		if (isRemote) {
			console.error(
				"❌ Set SEED_PROFILE explicitly when seeding a remote database.\n" +
					"   Production: SEED_PROFILE=minimal pnpm db:seed\n" +
					"   Staging:    SEED_PROFILE=dev pnpm db:seed",
			);
			process.exit(1);
		}
	}

	// SEED_PROFILE is intentionally separate from NODE_ENV.
	// Railway sets NODE_ENV=production on ALL deployed services (including staging)
	// for build/performance reasons, so NODE_ENV cannot reliably distinguish staging
	// from production at seed time. Set SEED_PROFILE explicitly in your deploy command:
	//   production: SEED_PROFILE=minimal pnpm db:seed
	//   staging:    pnpm db:seed   (defaults to "dev")
	const seedProfile = process.env.SEED_PROFILE || "dev";
	console.log(`🌱 Seeding database with profile: "${seedProfile}"`);

	if (seedProfile === "minimal") {
		await seedMinimal(prisma);
	} else {
		await seedDev(prisma);
	}

	console.log("✅ Database seeding completed");
}

main().catch((error) => {
	console.error("❌ Seed failed:", error);
	process.exit(1);
});
