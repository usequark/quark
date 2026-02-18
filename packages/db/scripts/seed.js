import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { prisma } from "../src/index.js";

// Deterministic output — change this integer to get a different but consistent dataset
faker.seed(42);

const PROFILE = process.env.SEED_PROFILE ?? "dev";
const VALID_PROFILES = ["minimal", "dev"];

if (!VALID_PROFILES.includes(PROFILE)) {
	console.error(
		`Unknown SEED_PROFILE "${PROFILE}". Valid options: ${VALID_PROFILES.join(", ")}`,
	);
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Seeders
// ---------------------------------------------------------------------------

async function seedUsers() {
	const users = [
		{
			email: "admin@example.com",
			name: "Admin User",
			role: "admin",
			password: "Password1",
		},
		{
			email: "viewer@example.com",
			name: "Viewer User",
			role: "viewer",
			password: "Password1",
		},
	];

	const seeded = [];
	for (const userData of users) {
		const hashed = await bcrypt.hash(userData.password, 12);
		const user = await prisma.user.upsert({
			where: { email: userData.email },
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
	// Audit logs — representative actions per user
	const actions = ["user.login", "user.update", "file.upload"];
	await prisma.auditLog.deleteMany({ where: { action: { in: actions } } });
	for (const user of users) {
		for (const action of actions) {
			await prisma.auditLog.create({
				data: {
					userId: user.id,
					action,
					entity: "User",
					entityId: user.id,
					metadata: {
						ip: faker.internet.ipv4(),
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
