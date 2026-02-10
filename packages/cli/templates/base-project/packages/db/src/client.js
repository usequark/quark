import { createDbClient } from "@Bobnoddle/quark-core";

export const prisma = createDbClient();

export * from "./generated/prisma/client.js";
