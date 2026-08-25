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
