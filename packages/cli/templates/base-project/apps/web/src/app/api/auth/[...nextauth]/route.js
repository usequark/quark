import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

const handler = (...args) => NextAuth(getAuthOptions())(...args);

export { handler as GET, handler as POST };
