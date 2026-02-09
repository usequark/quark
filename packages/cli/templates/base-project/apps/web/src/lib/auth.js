import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma, user } from "@quark/db";
import { createAuthConfig, verifyPassword } from "@quark/core";

const providers = [
  CredentialsProvider.default({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const existingUser = await user.findByEmail(credentials.email);
      
      if (!existingUser || !existingUser.password) {
        return null;
      }

      const isValid = await verifyPassword(credentials.password, existingUser.password);

      if (!isValid) {
        return null;
      }

      return {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        image: existingUser.image,
      };
    }
  })
];

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GithubProvider.default({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    })
  );
}

export const authOptions = createAuthConfig({
  adapter: PrismaAdapter(prisma),
  providers: providers,
  session: {
    strategy: "jwt",
  },
});
