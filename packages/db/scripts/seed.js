import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

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
