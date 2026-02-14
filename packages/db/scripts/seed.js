import { resolve } from "node:path";
import { config } from "dotenv";

// Load .env from monorepo root (mirrors prisma.config.ts)
config({ path: resolve(import.meta.dirname, "../../../.env") });

// Import after env is loaded so client.js picks up the correct values
const { prisma } = await import("../src/index.js");

async function main() {
	console.log("Seeding database...");

	const email = "test@example.com";

	const user = await prisma.user.upsert({
		where: { email },
		update: {},
		create: {
			email,
			name: "Test User",
			image: "https://api.dicebear.com/7.x/avataaars/svg?seed=test",
			posts: {
				create: [
					{
						title: "Hello World",
						content: "This is a seeded post. Welcome to Quark!",
						published: true,
					},
					{
						title: "Draft Post",
						content: "This is a draft post. It is not published yet.",
						published: false,
					},
				],
			},
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
