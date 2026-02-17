import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
	console.log("Seeding database...");

	const email = "test@example.com";
	const password = await bcrypt.hash("Password1", 12);

	const user = await prisma.user.upsert({
		where: { email },
		update: {},
		create: {
			email,
			name: "Test User",
			password,
			image: "https://api.dicebear.com/7.x/avataaars/svg?seed=test",
		},
	});

	console.log("Seeded user:", user.email);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
