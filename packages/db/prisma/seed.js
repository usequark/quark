import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { getConnectionString } from "../src/connection.js";
import { PrismaClient } from "../src/generated/prisma/client.ts";

/**
 * Deterministic hash for dev seed users only.
 * The app uses bcrypt for real user passwords — do not use this elsewhere.
 */
function devHash(password) {
	return crypto.createHash("sha256").update(`${password}salt`).digest("hex");
}

/**
 * Minimal seed: creates a single admin user.
 * Used standalone in production initial setup (SEED_PROFILE=minimal).
 * Also called by seedDev to avoid duplication.
 */
async function seedMinimal(prisma) {
	const existing = await prisma.user.findUnique({
		where: { email: "admin@example.com" },
	});

	if (existing) {
		console.log("✓ Admin user already exists");
		return null;
	}

	const admin = await prisma.user.create({
		data: {
			email: "admin@example.com",
			name: "Admin User",
			role: "admin",
			password: devHash("admin123"),
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

	// If admin already existed, skip the rest to remain idempotent
	if (!admin) return;

	const sampleUser = await prisma.user.create({
		data: {
			email: "user@example.com",
			name: "Sample User",
			role: "viewer",
			image: "https://api.dicebear.com/7.x/avataaars/svg?seed=user@example.com",
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

async function main() {
	const prisma = new PrismaClient({
		adapter: new PrismaPg({ connectionString: getConnectionString() }),
		errorFormat: "pretty",
	});

	try {
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
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((error) => {
	console.error("❌ Seed failed:", error.message);
	process.exit(1);
});
