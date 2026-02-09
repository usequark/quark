import { createDbClient } from "@quark/core";

export const prisma = createDbClient();

export * from "./generated/prisma/client.js";
