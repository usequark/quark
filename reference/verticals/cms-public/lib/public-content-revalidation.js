import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_CONTENT_TAG } from "./public-content.js";
import {
	getPublicContentRouteByModel,
	getPublicContentRoutes,
} from "./public-content-routes.js";

export async function isPublicContentModel(modelName) {
	return Boolean(await getPublicContentRouteByModel(modelName));
}

export async function revalidatePublicContent() {
	revalidateTag(PUBLIC_CONTENT_TAG);

	const routes = await getPublicContentRoutes();
	const routePatterns = new Set(routes.map((route) => route.routePattern));

	for (const routePattern of routePatterns) {
		revalidatePath(routePattern, "page");
	}

	revalidatePath("/", "layout");
	revalidatePath("/sitemap.xml");
	revalidatePath("/robots.txt");
}
