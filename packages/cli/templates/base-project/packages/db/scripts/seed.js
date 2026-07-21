import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { prisma } from "../src/index.js";

// Deterministic output - change this integer to get a different but consistent dataset
faker.seed(42);

const PROFILE = process.env.SEED_PROFILE ?? "dev";
const VALID_PROFILES = ["minimal", "dev"];

if (!VALID_PROFILES.includes(PROFILE)) {
	console.error(
		`Unknown SEED_PROFILE "${PROFILE}". Valid options: ${VALID_PROFILES.join(", ")}`,
	);
	process.exit(1);
}

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

// ---------------------------------------------------------------------------
// Seeders
// ---------------------------------------------------------------------------

async function seedUsers() {
	const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
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

	const users = [
		{
			email: adminEmail,
			name: adminName,
			role: "admin",
			password: adminPassword,
		},
		{
			// Dev-only sample account - password is randomly generated and logged once.
			email: "viewer@example.com",
			name: "Viewer User",
			role: "viewer",
			password: faker.internet.password({ length: 16, memorable: false }),
		},
	];

	const seeded = [];
	for (const userData of users) {
		// Skip hashing if the user already exists - upsert update:{} won't use it anyway.
		const existing = await prisma.user.findUnique({
			where: { email: userData.email },
		});
		const hashed =
			existing?.password ?? (await bcrypt.hash(userData.password, 12));
		const user = await prisma.user.upsert({
			where: { email: userData.email },
			// update:{} intentionally leaves existing users unchanged on re-seed.
			// To reset a user's password or role, delete the row first or update the create block.
			update: {},
			create: {
				email: userData.email,
				name: userData.name,
				role: userData.role,
				password: hashed,
				image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.email}`,
			},
		});
		seeded.push(user);
		console.log(`  ✓ User: ${user.email} (${user.role})`);
	}
	return seeded;
}

async function seedDevData(users) {
	// Audit logs - representative actions per user
	const actions = ["user.login", "user.update", "file.upload"];
	const userIds = users.map((u) => u.id);
	// Scoped to seeded user IDs so real audit entries in a shared dev DB are not wiped.
	await prisma.auditLog.deleteMany({
		where: { userId: { in: userIds }, action: { in: actions } },
	});
	for (const user of users) {
		for (const action of actions) {
			await prisma.auditLog.create({
				data: {
					userId: user.id,
					action,
					entity: "User",
					entityId: user.id,
					metadata: {
						ip: faker.internet.ip(),
						userAgent: faker.internet.userAgent(),
					},
				},
			});
		}
	}
	console.log(`  ✓ AuditLogs: ${users.length * actions.length} rows`);

	// A sample pending job so the worker dashboard has something to show
	await prisma.job.deleteMany({ where: { name: "seed-example-job" } });
	await prisma.job.create({
		data: {
			queue: "default",
			name: "seed-example-job",
			data: { message: "Hello from seed" },
			status: "PENDING",
		},
	});
	console.log("  ✓ Job: seed-example-job (PENDING)");
}

// ---------------------------------------------------------------------------
// Add your own model seeders below and call them from main()
// Example:
//   async function seedTeams(users) {
//     await prisma.team.upsert({ where: { slug: "acme" }, update: {}, create: { ... } });
//   }
// ---------------------------------------------------------------------------

async function main() {
	console.log(`\nSeeding database [profile: ${PROFILE}]...\n`);

	const users = await seedUsers();

	if (PROFILE === "dev") {
		await seedDevData(users);
	}

	// Add your seeders here:
	// await seedTeams(users);

	console.log("\nDone.\n");
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
