import { NextRequest } from "next/server.js";

export function normalizeAuthRequest(request) {
	if (process.env.NODE_ENV !== "development") {
		return request;
	}

	const forwardedHost = request.headers.get("x-forwarded-host");
	const host = request.headers.get("host");
	const incomingHost = forwardedHost || host;

	if (!incomingHost) {
		return request;
	}

	const forwardedProto = request.headers.get("x-forwarded-proto");
	const incomingProtocol = forwardedProto
		? forwardedProto.split(",")[0].trim()
		: "http";
	const currentUrl = new URL(request.url);
	const currentOrigin = `${currentUrl.protocol}//${currentUrl.host}`;
	const incomingOrigin = `${incomingProtocol}://${incomingHost}`;

	if (currentOrigin === incomingOrigin) {
		return request;
	}

	const normalizedUrl = new URL(request.url);
	normalizedUrl.protocol = `${incomingProtocol}:`;
	normalizedUrl.host = incomingHost;

	return new NextRequest(normalizedUrl, request);
}
