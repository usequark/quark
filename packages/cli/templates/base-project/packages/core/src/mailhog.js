/**
 * Builds MAILHOG_SMTP_URL from individual environment variables if not explicitly provided.
 * Allows configuration via individual MAILHOG_* vars instead of a single MAILHOG_SMTP_URL.
 */
function getMailhogSmtpUrl() {
	if (process.env.MAILHOG_SMTP_URL) {
		return process.env.MAILHOG_SMTP_URL;
	}

	const host = process.env.MAILHOG_HOST || "localhost";
	const port = process.env.MAILHOG_SMTP_PORT || "1025";

	return `smtp://${host}:${port}`;
}

/**
 * Builds Mailhog Web UI URL from individual environment variables.
 * Useful for displaying the URL in logs or configuration.
 */
function getMailhogUiUrl() {
	const host = process.env.MAILHOG_HOST || "localhost";
	const port = process.env.MAILHOG_UI_PORT || "8025";

	return `http://${host}:${port}`;
}

/**
 * Gets Mailhog SMTP configuration for email clients.
 */
export const getMailhogSmtpConfig = () => {
	const url = getMailhogSmtpUrl();
	const [, hostPort] = url.match(/smtp:\/\/([^:]+):(\d+)/) || [];
	const [host, port] = hostPort
		? hostPort.split(":")
		: [
				process.env.MAILHOG_HOST || "localhost",
				process.env.MAILHOG_SMTP_PORT || "1025",
			];

	return {
		host,
		port: parseInt(port, 10),
		url,
	};
};

export { getMailhogSmtpUrl, getMailhogUiUrl };
