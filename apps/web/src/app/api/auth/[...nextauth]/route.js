import { handlers } from "@/lib/auth";

export const GET = (req, context) => handlers.GET(req, context);
export const POST = (req, context) => handlers.POST(req, context);
