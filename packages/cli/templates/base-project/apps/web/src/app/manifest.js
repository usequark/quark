import { config, getAppUrl } from "@techstream/quark-config";

export default function manifest() {
	return {
		name: config.appName,
		short_name: config.appName,
		description: config.appDescription,
		start_url: "/",
		display: "standalone",
		id: getAppUrl(),
	};
}
