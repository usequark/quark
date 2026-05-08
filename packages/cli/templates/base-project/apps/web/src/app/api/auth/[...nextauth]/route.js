import { handlers } from "@/lib/auth";
import { normalizeAuthRequest } from "@/lib/normalize-auth-request";

export const GET = (req, context) =>
	handlers.GET(normalizeAuthRequest(req), context);
export const POST = (req, context) =>
	handlers.POST(normalizeAuthRequest(req), context);
